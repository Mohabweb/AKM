"use client";

import { useState } from "react";
import { saveSettingsAction, deleteDemoDataAction } from "@/app/(admin)/admin/actions";

export function SettingsForm({
  settings = {},
  isOwner,
}: {
  settings: Record<string, string>;
  isOwner: boolean;
}) {
  const [demoDeleted, setDemoDeleted] = useState<{
    products: number;
    brands: number;
    categories: number;
  } | null>(null);
  const [loadingDemo, setLoadingDemo] = useState(false);

  const handleDeleteDemo = async () => {
    if (
      !confirm(
        "Are you sure you want to delete all demo data? This will permanently remove all demo products, demo brands, and demo categories. This cannot be undone."
      )
    ) {
      return;
    }

    setLoadingDemo(true);
    try {
      const res = await deleteDemoDataAction();
      setDemoDeleted(res);
    } catch (err: any) {
      alert(err?.message || "Failed to delete demo data");
    } finally {
      setLoadingDemo(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Store Settings Form */}
      <form action={saveSettingsAction} className="space-y-6">
        {/* Contact Information */}
        <div className="bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-[#0B1F23]">Store & Contact Details</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Store Name
              </label>
              <input
                name="store_name"
                defaultValue={settings.store_name || "AKM Luxury Shoes"}
                disabled={!isOwner}
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs font-medium focus:ring-2 focus:ring-[#0E7C89]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Contact Phone
              </label>
              <input
                name="contact_phone"
                defaultValue={settings.contact_phone || ""}
                disabled={!isOwner}
                placeholder="01200756172"
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs focus:ring-2 focus:ring-[#0E7C89]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Customer Support Email
              </label>
              <input
                name="contact_email"
                type="email"
                defaultValue={settings.contact_email || ""}
                disabled={!isOwner}
                placeholder="contact@akmshoes.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs focus:ring-2 focus:ring-[#0E7C89]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Postal Code
              </label>
              <input
                name="store_postal_code"
                defaultValue={settings.store_postal_code || "20220"}
                disabled={!isOwner}
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">
              Store Physical Address (Shown in Footer & Invoices)
            </label>
            <input
              name="store_address"
              defaultValue={settings.store_address || ""}
              disabled={!isOwner}
              className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs"
            />
          </div>
        </div>

        {/* Payment & Messaging: InstaPay & WhatsApp */}
        <div className="bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-[#0B1F23]">InstaPay & WhatsApp Business</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                InstaPay Mobile Number *
              </label>
              <input
                name="instapay_number"
                defaultValue={settings.instapay_number || "01200756172"}
                disabled={!isOwner}
                placeholder="01200756172"
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs font-mono font-bold focus:ring-2 focus:ring-[#0E7C89]"
              />
              <p className="text-[11px] text-neutral-400 mt-1">
                The account number customers transfer to at checkout.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                InstaPay Account Holder Name (Optional)
              </label>
              <input
                name="instapay_account_name"
                defaultValue={settings.instapay_account_name || ""}
                disabled={!isOwner}
                placeholder="AKM Store"
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">
              WhatsApp Business Number (International Format: 20XXXXXXXXXX)
            </label>
            <input
              name="whatsapp_number"
              defaultValue={settings.whatsapp_number || ""}
              disabled={!isOwner}
              placeholder="201200756172"
              className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs font-mono"
            />
            <p className="text-[11px] text-neutral-400 mt-1">
              Leave empty if you wish to hide WhatsApp ordering on the storefront.
            </p>
          </div>
        </div>

        {/* Social Media Links */}
        <div className="bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-[#0B1F23]">Social Media Profiles</h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Instagram URL
              </label>
              <input
                name="social_instagram"
                defaultValue={settings.social_instagram || "https://www.instagram.com/akm_egy"}
                disabled={!isOwner}
                className="w-full px-3.5 py-2 rounded-xl border border-neutral-300 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                TikTok URL
              </label>
              <input
                name="social_tiktok"
                defaultValue={settings.social_tiktok || "https://www.tiktok.com/@akm_store1"}
                disabled={!isOwner}
                className="w-full px-3.5 py-2 rounded-xl border border-neutral-300 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Facebook URL
              </label>
              <input
                name="social_facebook"
                defaultValue={settings.social_facebook || "https://www.facebook.com/share/1DMt6k4yF2/"}
                disabled={!isOwner}
                className="w-full px-3.5 py-2 rounded-xl border border-neutral-300 text-xs"
              />
            </div>
          </div>
        </div>

        {/* Policies */}
        <div className="bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-[#0B1F23]">Store Policies</h2>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">
              Returns & Exchanges Policy
            </label>
            <textarea
              name="policy_returns"
              rows={3}
              defaultValue={settings.policy_returns || ""}
              disabled={!isOwner}
              className="w-full p-3 rounded-xl border border-neutral-300 text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">
              Delivery Policy
            </label>
            <textarea
              name="policy_delivery"
              rows={2}
              defaultValue={settings.policy_delivery || ""}
              disabled={!isOwner}
              className="w-full p-3 rounded-xl border border-neutral-300 text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">
              Privacy Policy
            </label>
            <textarea
              name="policy_privacy"
              rows={3}
              defaultValue={settings.policy_privacy || ""}
              disabled={!isOwner}
              className="w-full p-3 rounded-xl border border-neutral-300 text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">
              Terms of Sale
            </label>
            <textarea
              name="policy_terms"
              rows={3}
              defaultValue={settings.policy_terms || ""}
              disabled={!isOwner}
              className="w-full p-3 rounded-xl border border-neutral-300 text-xs"
            />
          </div>
        </div>

        {isOwner && (
          <button
            type="submit"
            className="w-full py-3.5 px-6 rounded-xl bg-[#0E7C89] hover:bg-[#0b646f] text-white font-bold text-sm shadow-sm transition-colors"
          >
            Save All Settings
          </button>
        )}
      </form>

      {/* Owner-Only: Delete Demo Data */}
      {isOwner && (
        <div className="p-6 rounded-2xl border-2 border-red-200 bg-red-50/50 space-y-4">
          <div>
            <h2 className="text-base font-bold text-red-900">Pre-Launch: Remove Demo Catalog Data</h2>
            <p className="text-xs text-red-700 mt-0.5">
              Permanently purges all initial placeholder demo shoes, demo brands, and demo collections from the database.
            </p>
          </div>

          {demoDeleted ? (
            <div className="p-4 rounded-xl bg-white border border-red-200 text-xs text-red-900 space-y-1">
              <p className="font-bold">✓ Demo data successfully removed:</p>
              <p>• {demoDeleted.products} demo product(s) deleted</p>
              <p>• {demoDeleted.brands} demo brand(s) deleted</p>
              <p>• {demoDeleted.categories} demo category(ies) deleted</p>
            </div>
          ) : (
            <button
              type="button"
              disabled={loadingDemo}
              onClick={handleDeleteDemo}
              className="px-5 py-3 rounded-xl bg-red-700 hover:bg-red-800 text-white font-bold text-xs shadow-xs transition-colors disabled:opacity-50"
            >
              {loadingDemo ? "Deleting Demo Data..." : "🗑️ Delete Demo Data (Owner Only)"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
