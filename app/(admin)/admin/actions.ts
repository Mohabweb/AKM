"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { requireAdmin, getAdmin, type Admin } from "@/lib/auth";
import { sessionClient } from "@/lib/supabase/server";
import { serviceClient } from "@/lib/supabase/service";
import { allow, clientIp } from "@/lib/rate-limit";
import { describeMfaFailure, hasVerifiedTotp, totpFactors } from "@/lib/mfa";
import { logDetail } from "@/lib/api-errors";

/** Authenticator apps display codes with a space ("123 456"); keep digits only. */
function normalizeCode(value: FormDataEntryValue | null): string {
  return String(value ?? "").replace(/\D/g, "");
}

// -------------------------------------------------------------
// Auth Actions
// -------------------------------------------------------------

export async function loginAction(
  _prevState: unknown,
  formData: FormData
): Promise<{ error?: string; lockout?: boolean; redirectUrl?: string }> {
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Please enter your email and password." };
  }

  const ip = await clientIp();

  // 1. IP rate limit: max 10 attempts per 10 minutes
  const ipAllowed = await allow("login_ip", ip, 600, 10);
  if (!ipAllowed) {
    return {
      error: "Too many login attempts from this network. Please wait 10 minutes before trying again.",
      lockout: true,
    };
  }

  // 2. Account lockout: max 5 failed attempts per 15 minutes
  const accountAllowed = await allow("login_lockout", email, 900, 5);
  if (!accountAllowed) {
    return {
      error: "This account has been temporarily locked due to 5 consecutive failed attempts. Please wait 15 minutes or reset your password.",
      lockout: true,
    };
  }

  const sb = await sessionClient();
  const { data: authData, error: authError } = await sb.auth.signInWithPassword({
    email,
    password,
  });

  if (authError || !authData.user) {
    return { error: "Invalid email or password. Please try again." };
  }

  // Verify the user is registered in admin_users
  const service = serviceClient();
  const { data: adminUser } = await service
    .from("admin_users")
    .select("role")
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (!adminUser) {
    await sb.auth.signOut();
    return { error: "Access denied. You do not have an administrator account." };
  }

  // Check MFA status
  const { data: aalData } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalData?.currentLevel === "aal2") {
    redirect("/admin/orders");
  }

  // User is at aal1 — check if they have an active TOTP factor
  const { data: factors } = await sb.auth.mfa.listFactors();

  if (hasVerifiedTotp(factors)) {
    redirect("/admin/mfa-verify");
  } else {
    redirect("/admin/mfa-enroll");
  }
}

export type MfaEnrollInit = {
  error?: string;
  factorId?: string;
  qrCode?: string;
  secret?: string;
  uri?: string;
  /** A previous unfinished enrollment was replaced, so an older app entry is now stale. */
  replacedSetup?: boolean;
  /** Send the browser here instead (session expired, or 2FA is already active). */
  redirectTo?: string;
};

export async function mfaEnrollInitAction(): Promise<MfaEnrollInit> {
  const sb = await sessionClient();
  const { data: userData } = await sb.auth.getUser();
  if (!userData?.user) {
    return { error: "Your session expired. Please sign in again.", redirectTo: "/admin/login" };
  }

  const { data: factorList, error: listErr } = await sb.auth.mfa.listFactors();
  if (listErr) {
    const failure = describeMfaFailure(listErr);
    console.error(`[admin/mfa] listFactors failed reason=${failure.reason}`, logDetail(listErr));
    return { error: failure.error, redirectTo: failure.kind === "session" ? "/admin/login" : undefined };
  }

  const totp = totpFactors(factorList);

  // Already enrolled: verifying is the only useful next step (never add a second factor).
  if (totp.some((f) => f.status === "verified")) {
    return { redirectTo: "/admin/mfa-verify" };
  }

  // GoTrue refuses a new enroll while an unverified factor of the same name exists
  // ("A factor with the friendly name … already exists"). That used to leave this page stuck on
  // "Setup Failed" forever: no QR code and no way forward. Clear the stale pending factor first so
  // every visit renders a QR code that can actually be verified.
  let replacedSetup = false;
  for (const f of totp) {
    const { error } = await sb.auth.mfa.unenroll({ factorId: f.id });
    if (error) {
      const failure = describeMfaFailure(error);
      console.error(`[admin/mfa] unenroll pending factor failed reason=${failure.reason}`, logDetail(error));
      return { error: failure.error, redirectTo: failure.kind === "session" ? "/admin/login" : undefined };
    }
    replacedSetup = true;
  }

  const { data, error } = await sb.auth.mfa.enroll({
    factorType: "totp",
    issuer: "AKM Luxury Shoes",
    friendlyName: userData.user.email,
  });

  if (error || !data) {
    const failure = describeMfaFailure(error);
    console.error(`[admin/mfa] enroll failed reason=${failure.reason}`, logDetail(error));
    return {
      error: failure.error,
      replacedSetup,
      redirectTo: failure.kind === "session" ? "/admin/login" : undefined,
    };
  }

  return {
    factorId: data.id,
    qrCode: data.totp?.qr_code,
    secret: data.totp?.secret,
    uri: data.totp?.uri,
    replacedSetup,
  };
}

export async function mfaEnrollVerifyAction(
  _prevState: unknown,
  formData: FormData
): Promise<{ error?: string; restart?: boolean; reason?: string }> {
  const factorId = formData.get("factorId") as string;
  const code = normalizeCode(formData.get("code"));

  if (!factorId) {
    return { error: "This setup page went stale. Reload it to show a fresh QR code.", restart: true, reason: "MISSING_FACTOR_ID" };
  }
  if (!code || code.length !== 6) {
    return { error: "Please enter the 6-digit code from your authenticator app." };
  }

  const sb = await sessionClient();
  const { data, error } = await sb.auth.mfa.challengeAndVerify({
    factorId,
    code,
  });

  if (error || !data) {
    const failure = describeMfaFailure(error);
    console.error(`[admin/mfa] enroll verify failed reason=${failure.reason}`, logDetail(error));
    return { error: failure.error, restart: failure.restart, reason: failure.reason };
  }

  redirect("/admin/orders");
}

export async function mfaVerifyAction(
  _prevState: unknown,
  formData: FormData
): Promise<{ error?: string; restart?: boolean; reason?: string; redirectTo?: string }> {
  const code = normalizeCode(formData.get("code"));
  if (!code || code.length !== 6) {
    return { error: "Please enter the 6-digit code from your authenticator app." };
  }

  const sb = await sessionClient();
  const { data: factors, error: factorsErr } = await sb.auth.mfa.listFactors();
  if (factorsErr) {
    const failure = describeMfaFailure(factorsErr);
    console.error(`[admin/mfa] listFactors failed reason=${failure.reason}`, logDetail(factorsErr));
    return {
      error: failure.error,
      reason: failure.reason,
      redirectTo: failure.kind === "session" ? "/admin/login" : undefined,
    };
  }

  const totpFactor = totpFactors(factors).find((f) => f.status === "verified");
  // Only a verified factor can be challenged; an unfinished enrollment has to be redone.
  if (!totpFactor) {
    return {
      error: "Two-factor authentication isn't active on this account yet. Reload to finish the setup.",
      reason: "NO_VERIFIED_FACTOR",
      redirectTo: "/admin/mfa-enroll",
    };
  }

  const { data: challengeData, error: challengeErr } = await sb.auth.mfa.challenge({
    factorId: totpFactor.id,
  });
  if (challengeErr || !challengeData) {
    const failure = describeMfaFailure(challengeErr);
    console.error(`[admin/mfa] challenge failed reason=${failure.reason}`, logDetail(challengeErr));
    return {
      error: failure.error,
      restart: failure.restart,
      reason: failure.reason,
      redirectTo: failure.kind === "session" ? "/admin/login" : undefined,
    };
  }

  const { data: verifyData, error: verifyErr } = await sb.auth.mfa.verify({
    factorId: totpFactor.id,
    challengeId: challengeData.id,
    code,
  });

  if (verifyErr || !verifyData) {
    const failure = describeMfaFailure(verifyErr);
    console.error(`[admin/mfa] verify failed reason=${failure.reason}`, logDetail(verifyErr));
    return { error: failure.error, restart: failure.restart, reason: failure.reason };
  }

  redirect("/admin/orders");
}

export async function forgotPasswordAction(
  _prevState: unknown,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  if (!email) return { error: "Please enter your email address." };

  const ip = await clientIp();
  const allowed = await allow("forgot_pw", `${ip}:${email}`, 300, 3);
  if (!allowed) {
    return { error: "Too many password reset requests. Please wait a few minutes." };
  }

  const h = await headers();
  const origin = h.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const sb = await sessionClient();
  await sb.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/admin/reset-password`,
  });

  // Always return success to prevent email enumeration
  return { success: true };
}

export async function resetPasswordAction(
  _prevState: unknown,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!password || password.length < 8) {
    return { error: "Password must be at least 8 characters long." };
  }
  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  const sb = await sessionClient();
  const { error } = await sb.auth.updateUser({ password });
  if (error) {
    return { error: error.message };
  }

  redirect("/admin/login?reset=success");
}

export async function logoutAction() {
  const sb = await sessionClient();
  await sb.auth.signOut();
  redirect("/admin/login");
}

// -------------------------------------------------------------
// Orders Actions
// -------------------------------------------------------------

export async function setOrderStatusAction(orderId: string, toStatus: string, note?: string) {
  const admin = await requireAdmin();
  if (toStatus === "refunded" && admin.role !== "owner") {
    throw new Error("Only store owners can issue refunds.");
  }

  const sb = await sessionClient();
  const { error } = await sb.rpc("set_order_status", {
    p_order: orderId,
    p_to: toStatus as any,
    p_note: note || null,
  });

  if (error) {
    throw new Error(`Failed to change status: ${error.message}`);
  }

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin");
}

export async function setOrderInternalNotesAction(orderId: string, notes: string) {
  await requireAdmin();
  const sb = await sessionClient();
  const { error } = await sb.rpc("set_order_internal_notes", {
    p_order: orderId,
    p_notes: notes,
  });

  if (error) {
    throw new Error(`Failed to save internal note: ${error.message}`);
  }

  revalidatePath(`/admin/orders/${orderId}`);
}

export async function reviewReceiptAction(
  receiptId: string,
  orderId: string,
  approve: boolean,
  note?: string
) {
  await requireAdmin();
  const sb = await sessionClient();
  const { error } = await sb.rpc("review_receipt", {
    p_receipt: receiptId,
    p_approve: approve,
    p_note: note || null,
  });

  if (error) {
    throw new Error(`Receipt review failed: ${error.message}`);
  }

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin");
}

// -------------------------------------------------------------
// Products Actions
// -------------------------------------------------------------

export async function saveProductAction(formData: FormData) {
  await requireAdmin();
  const sb = await sessionClient();

  const id = formData.get("id") as string | null;
  const name = (formData.get("name") as string)?.trim();
  const slug = (formData.get("slug") as string)?.trim().toLowerCase();
  const description = (formData.get("description") as string) || "";
  const brandId = (formData.get("brandId") as string) || null;
  const priceEgp = Number(formData.get("priceEgp") || 0);
  const compareEgp = formData.get("compareEgp") ? Number(formData.get("compareEgp")) : null;
  const status = (formData.get("status") as string) || "draft";
  const isFeatured = formData.get("isFeatured") === "on";
  const isNewArrival = formData.get("isNewArrival") === "on";
  const metaTitle = (formData.get("metaTitle") as string) || null;
  const metaDescription = (formData.get("metaDescription") as string) || null;
  const categoryIds = formData.getAll("categoryIds") as string[];

  const pricePiasters = Math.round(priceEgp * 100);
  const comparePiasters = compareEgp ? Math.round(compareEgp * 100) : null;

  let productId = id;

  if (productId) {
    const { error } = await sb
      .from("products")
      .update({
        name,
        slug,
        description,
        brand_id: brandId,
        price_piasters: pricePiasters,
        compare_at_piasters: comparePiasters,
        status: status as any,
        is_featured: isFeatured,
        is_new_arrival: isNewArrival,
        meta_title: metaTitle,
        meta_description: metaDescription,
      })
      .eq("id", productId);

    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await sb
      .from("products")
      .insert({
        name,
        slug,
        description,
        brand_id: brandId,
        price_piasters: pricePiasters,
        compare_at_piasters: comparePiasters,
        status: status as any,
        is_featured: isFeatured,
        is_new_arrival: isNewArrival,
        meta_title: metaTitle,
        meta_description: metaDescription,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    productId = data.id;
  }

  // Update categories
  await sb.from("product_categories").delete().eq("product_id", productId);
  if (categoryIds.length > 0) {
    const pcatRows = categoryIds.map((cid) => ({
      product_id: productId,
      category_id: cid,
    }));
    await sb.from("product_categories").insert(pcatRows);
  }

  updateTag("catalog");
  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${productId}`);
  redirect("/admin/products");
}

export async function setProductStatusAction(
  productId: string,
  newStatus: "draft" | "published" | "archived"
) {
  await requireAdmin();
  const sb = await sessionClient();
  const { error } = await sb
    .from("products")
    .update({ status: newStatus })
    .eq("id", productId);

  if (error) throw new Error(error.message);

  updateTag("catalog");
  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${productId}`);
}

export async function deleteProductAction(productId: string) {
  await requireAdmin("owner");
  const sb = await sessionClient();
  const { error } = await sb.from("products").delete().eq("id", productId);
  if (error) throw new Error(error.message);

  updateTag("catalog");
  revalidatePath("/admin/products");
}

export async function duplicateProductAction(productId: string) {
  await requireAdmin();
  const sb = await sessionClient();

  const { data: original, error: getErr } = await sb
    .from("products")
    .select("*, product_variants(*), product_categories(*)")
    .eq("id", productId)
    .single();

  if (getErr || !original) throw new Error("Product not found");

  const newSlug = `${original.slug}-copy-${Date.now().toString(36)}`;
  const { data: newProd, error: insertErr } = await sb
    .from("products")
    .insert({
      name: `${original.name} (Copy)`,
      slug: newSlug,
      description: original.description,
      brand_id: original.brand_id,
      price_piasters: original.price_piasters,
      compare_at_piasters: original.compare_at_piasters,
      status: "draft",
      is_featured: false,
      is_new_arrival: false,
      meta_title: original.meta_title,
      meta_description: original.meta_description,
    })
    .select("id")
    .single();

  if (insertErr || !newProd) throw new Error(insertErr?.message || "Failed to duplicate");

  // Copy variants
  if (original.product_variants?.length) {
    const vRows = original.product_variants.map((v: any) => ({
      product_id: newProd.id,
      sku: `${v.sku}-${Date.now().toString(36).slice(-4)}`,
      size: v.size,
      color: v.color,
      stock: v.stock,
      is_active: v.is_active,
    }));
    await sb.from("product_variants").insert(vRows);
  }

  // Copy categories
  if (original.product_categories?.length) {
    const cRows = original.product_categories.map((c: any) => ({
      product_id: newProd.id,
      category_id: c.category_id,
    }));
    await sb.from("product_categories").insert(cRows);
  }

  updateTag("catalog");
  revalidatePath("/admin/products");
  redirect(`/admin/products/${newProd.id}`);
}

export async function saveVariantAction(formData: FormData) {
  await requireAdmin();
  const sb = await sessionClient();

  const id = formData.get("id") as string | null;
  const productId = formData.get("productId") as string;
  const sku = (formData.get("sku") as string)?.trim().toUpperCase();
  const size = (formData.get("size") as string)?.trim();
  const color = (formData.get("color") as string)?.trim() || "";
  const stock = Math.max(0, parseInt((formData.get("stock") as string) || "0", 10));

  if (!productId || !sku || !size) {
    throw new Error("Product ID, SKU, and Size are required.");
  }

  if (id) {
    const { error } = await sb
      .from("product_variants")
      .update({ sku, size, color, stock })
      .eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await sb
      .from("product_variants")
      .insert({ product_id: productId, sku, size, color, stock });
    if (error) throw new Error(error.message);
  }

  updateTag("catalog");
  revalidatePath(`/admin/products/${productId}`);
}

export async function deleteVariantAction(variantId: string, productId: string) {
  await requireAdmin();
  const sb = await sessionClient();
  const { error } = await sb.from("product_variants").delete().eq("id", variantId);
  if (error) throw new Error(error.message);

  updateTag("catalog");
  revalidatePath(`/admin/products/${productId}`);
}

export async function deleteProductImageAction(imageId: string, productId: string) {
  await requireAdmin();
  const sb = await sessionClient();
  const { error } = await sb.from("product_images").delete().eq("id", imageId);
  if (error) throw new Error(error.message);

  updateTag("catalog");
  revalidatePath(`/admin/products/${productId}`);
}

// -------------------------------------------------------------
// Brands & Categories Actions
// -------------------------------------------------------------

export async function saveBrandAction(formData: FormData) {
  await requireAdmin();
  const sb = await sessionClient();

  const id = formData.get("id") as string | null;
  const name = (formData.get("name") as string)?.trim();
  const slug = (formData.get("slug") as string)?.trim().toLowerCase();
  const logoUrl = (formData.get("logoUrl") as string)?.trim() || null;
  const sortOrder = parseInt((formData.get("sortOrder") as string) || "0", 10);
  const isActive = formData.get("isActive") === "on";

  if (id) {
    const { error } = await sb
      .from("brands")
      .update({ name, slug, logo_url: logoUrl, sort_order: sortOrder, is_active: isActive })
      .eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await sb
      .from("brands")
      .insert({ name, slug, logo_url: logoUrl, sort_order: sortOrder, is_active: isActive });
    if (error) throw new Error(error.message);
  }

  updateTag("catalog");
  revalidatePath("/admin/brands");
}

export async function deleteBrandAction(id: string) {
  await requireAdmin("owner");
  const sb = await sessionClient();
  const { error } = await sb.from("brands").delete().eq("id", id);
  if (error) throw new Error(error.message);

  updateTag("catalog");
  revalidatePath("/admin/brands");
}

export async function saveCategoryAction(formData: FormData) {
  await requireAdmin();
  const sb = await sessionClient();

  const id = formData.get("id") as string | null;
  const name = (formData.get("name") as string)?.trim();
  const slug = (formData.get("slug") as string)?.trim().toLowerCase();
  const kind = (formData.get("kind") as string) || "category";
  const parentId = (formData.get("parentId") as string) || null;
  const description = (formData.get("description") as string)?.trim() || null;
  const imageUrl = (formData.get("imageUrl") as string)?.trim() || null;
  const sortOrder = parseInt((formData.get("sortOrder") as string) || "0", 10);
  const isActive = formData.get("isActive") === "on";

  if (id) {
    const { error } = await sb
      .from("categories")
      .update({
        name,
        slug,
        kind: kind as any,
        parent_id: parentId,
        description,
        image_url: imageUrl,
        sort_order: sortOrder,
        is_active: isActive,
      })
      .eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await sb.from("categories").insert({
      name,
      slug,
      kind: kind as any,
      parent_id: parentId,
      description,
      image_url: imageUrl,
      sort_order: sortOrder,
      is_active: isActive,
    });
    if (error) throw new Error(error.message);
  }

  updateTag("catalog");
  revalidatePath("/admin/categories");
}

export async function deleteCategoryAction(id: string) {
  await requireAdmin("owner");
  const sb = await sessionClient();
  const { error } = await sb.from("categories").delete().eq("id", id);
  if (error) throw new Error(error.message);

  updateTag("catalog");
  revalidatePath("/admin/categories");
}

// -------------------------------------------------------------
// Homepage & Announcement Actions
// -------------------------------------------------------------

export async function saveHomepageSectionAction(formData: FormData) {
  await requireAdmin("owner");
  const sb = await sessionClient();

  const id = formData.get("id") as string | null;
  const type = formData.get("type") as string;
  const title = (formData.get("title") as string)?.trim() || null;
  const subtitle = (formData.get("subtitle") as string)?.trim() || null;
  const source = (formData.get("source") as string) || null;
  const categoryId = (formData.get("categoryId") as string) || null;
  const sortOrder = parseInt((formData.get("sortOrder") as string) || "0", 10);
  const isActive = formData.get("isActive") === "on";

  let config = {};
  try {
    const rawConfig = formData.get("config") as string;
    if (rawConfig) config = JSON.parse(rawConfig);
  } catch {}

  if (id) {
    const { error } = await sb
      .from("homepage_sections")
      .update({
        type: type as any,
        title,
        subtitle,
        source: source as any,
        category_id: categoryId,
        config,
        sort_order: sortOrder,
        is_active: isActive,
      })
      .eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await sb.from("homepage_sections").insert({
      type: type as any,
      title,
      subtitle,
      source: source as any,
      category_id: categoryId,
      config,
      sort_order: sortOrder,
      is_active: isActive,
    });
    if (error) throw new Error(error.message);
  }

  updateTag("homepage");
  revalidatePath("/admin/homepage");
}

export async function deleteHomepageSectionAction(id: string) {
  await requireAdmin("owner");
  const sb = await sessionClient();
  const { error } = await sb.from("homepage_sections").delete().eq("id", id);
  if (error) throw new Error(error.message);

  updateTag("homepage");
  revalidatePath("/admin/homepage");
}

export async function updateAnnouncementAction(formData: FormData) {
  await requireAdmin("owner");
  const sb = await sessionClient();

  const enabled = formData.get("enabled") === "on";
  const text = (formData.get("text") as string)?.trim() || "";
  const href = (formData.get("href") as string)?.trim() || "";

  await sb.from("settings").update({ value: JSON.stringify(enabled) }).eq("key", "announcement_enabled");
  await sb.from("settings").update({ value: JSON.stringify(text) }).eq("key", "announcement_text");
  await sb.from("settings").update({ value: JSON.stringify(href) }).eq("key", "announcement_href");

  updateTag("settings");
  revalidatePath("/admin/announcement");
}

// -------------------------------------------------------------
// Shipping Fees Actions
// -------------------------------------------------------------

export async function updateShippingZoneAction(id: string, feeEgp: number, isActive: boolean) {
  await requireAdmin("owner");
  const sb = await sessionClient();
  const feePiasters = Math.round(feeEgp * 100);

  const { error } = await sb
    .from("shipping_zones")
    .update({ fee_piasters: feePiasters, is_active: isActive })
    .eq("id", id);

  if (error) throw new Error(error.message);

  updateTag("settings");
  revalidatePath("/admin/shipping");
}

export async function confirmShippingFeesReviewedAction() {
  await requireAdmin("owner");
  const sb = await sessionClient();
  await sb.from("settings").update({ value: "true" }).eq("key", "shipping_fees_reviewed");

  updateTag("settings");
  revalidatePath("/admin/shipping");
  revalidatePath("/admin");
}

// -------------------------------------------------------------
// Settings Actions
// -------------------------------------------------------------

export async function saveSettingsAction(formData: FormData) {
  await requireAdmin("owner");
  const sb = await sessionClient();

  const keys = [
    "store_name",
    "store_address",
    "store_postal_code",
    "contact_phone",
    "contact_email",
    "whatsapp_number",
    "instapay_number",
    "instapay_account_name",
    "social_instagram",
    "social_tiktok",
    "social_facebook",
    "policy_delivery",
    "policy_returns",
    "policy_privacy",
    "policy_terms",
  ];

  for (const k of keys) {
    if (formData.has(k)) {
      const val = (formData.get(k) as string) ?? "";
      await sb.from("settings").update({ value: JSON.stringify(val) }).eq("key", k);
    }
  }

  updateTag("settings");
  revalidatePath("/admin/settings");
}

export async function deleteDemoDataAction(): Promise<{
  products: number;
  brands: number;
  categories: number;
}> {
  await requireAdmin("owner");
  const sb = await sessionClient();

  const { data, error } = await sb.rpc("delete_demo_data");
  if (error) {
    throw new Error(`Failed to delete demo data: ${error.message}`);
  }

  updateTag("catalog");
  updateTag("homepage");
  revalidatePath("/admin");
  revalidatePath("/admin/products");
  revalidatePath("/admin/brands");
  revalidatePath("/admin/categories");

  return data as { products: number; brands: number; categories: number };
}

// -------------------------------------------------------------
// Staff Accounts Actions
// -------------------------------------------------------------

export async function createStaffAccountAction(formData: FormData) {
  await requireAdmin("owner");
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;
  const role = (formData.get("role") as string) || "staff";

  if (!email || !password || password.length < 8) {
    throw new Error("Valid email and password (min 8 chars) required.");
  }

  const service = serviceClient();
  const { data: user, error: userErr } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (userErr || !user.user) {
    throw new Error(userErr?.message || "Failed to create user");
  }

  const { error: adminErr } = await service.from("admin_users").insert({
    user_id: user.user.id,
    email,
    role: role as any,
  });

  if (adminErr) {
    throw new Error(adminErr.message);
  }

  revalidatePath("/admin/staff");
}

export async function updateStaffRoleAction(userId: string, newRole: "owner" | "staff") {
  await requireAdmin("owner");
  const sb = await sessionClient();
  const { error } = await sb
    .from("admin_users")
    .update({ role: newRole })
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/staff");
}

export async function deleteStaffAccountAction(userId: string) {
  await requireAdmin("owner");
  const service = serviceClient();
  const { error: dbErr } = await service.from("admin_users").delete().eq("user_id", userId);
  if (dbErr) throw new Error(dbErr.message);

  await service.auth.admin.deleteUser(userId);
  revalidatePath("/admin/staff");
}
