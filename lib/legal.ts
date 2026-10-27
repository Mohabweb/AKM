/** DRAFT legal text. Written as a starting point for the owner's lawyer — NOT legal advice and NOT reviewed.
 *  Square-bracket items are facts the owner/lawyer must fill in or confirm; nothing here invents a business fact. */
export const LEGAL_SLUGS = ["privacy", "terms", "returns", "shipping", "payment", "contact"] as const;
export type LegalSlug = (typeof LEGAL_SLUGS)[number];
export const DRAFT_NOTICE = "DRAFT — requires professional legal review";

export type LegalCtx = { instapay: string; address: string; postal: string; phone: string; email: string; whatsapp: string; social: [string, string][]; cod: boolean; card: boolean; instapayOn: boolean; storeText: Partial<Record<"privacy" | "terms" | "returns" | "shipping", string>> };
type Section = { h: string; p: string[] };
export type LegalDoc = { title: string; description: string; sections: Section[]; storeText?: string };

const OWNER = "[Legal business name and commercial registration / tax number — to be completed by the owner]";

export function legalDoc(slug: LegalSlug, c: LegalCtx): LegalDoc {
  switch (slug) {
    case "privacy": return {
      title: "Privacy policy", description: "How AKM Luxury Shoes collects, uses and protects your personal data.", storeText: c.storeText.privacy,
      sections: [
        { h: "Who we are", p: [`The data controller is AKM Luxury Shoes, ${OWNER}. Contact: ${c.email || "[privacy contact email]"}.`] },
        { h: "Legal framework", p: ["We process personal data in line with the Egyptian Personal Data Protection Law No. 151 of 2020 and its executive regulations. [Lawyer: confirm registration / licensing duties with the Personal Data Protection Centre and any controller obligations that apply to this business.]"] },
        { h: "Data we collect", p: ["Order data: your name, mobile number, delivery address (governorate, city, area, street, landmark) and delivery notes.", "Payment data: for InstaPay, the receipt image you upload. For card payments, the card is entered on the payment provider’s own page; card numbers never reach our servers.", "Technical data: your IP address is used for security (rate limiting and bot checks). Your cart and wishlist are stored in your own browser."] },
        { h: "Why we use it", p: ["To take, confirm, deliver and support your order (contract); to verify payments; to prevent fraud and abuse (legitimate interest); to keep legally required accounting records. We do not sell your data."] },
        { h: "Who receives it", p: ["Delivery couriers (name, phone, address); our hosting and database providers and, when card payment is enabled, the payment provider. [Owner: list the actual providers used.] Some providers may process data outside Egypt. [Lawyer: confirm the conditions for cross-border transfer.]"] },
        { h: "How long we keep it", p: ["[Owner/lawyer: set retention periods, for example order records for the period required for accounting, receipt images for a fixed number of months.]"] },
        { h: "Your rights", p: ["Under the law you may ask to know what data we hold, to access it, to correct it, to withdraw consent where processing is based on consent, to restrict or object to processing, and to request deletion where the law allows. Write to us at the contact details below."] },
        { h: "Cookies and tracking", p: ["This site uses no advertising or analytics cookies or pixels. Your browser’s local storage keeps your cart, wishlist and recently viewed items, which is strictly necessary for the shop to work. If analytics or advertising tools are added in future, they will load only after you give consent."] },
        { h: "Security", p: ["Receipts are kept in a private store visible only to authorised staff. Admin access requires two-factor authentication. No system is perfectly secure; tell us at once if you suspect a problem."] },
        { h: "Contact", p: [c.email || c.phone || "[contact details]"] },
      ] };
    case "terms": return {
      title: "Terms of sale", description: "Terms that apply when you buy from AKM Luxury Shoes.", storeText: c.storeText.terms,
      sections: [
        { h: "The seller", p: [`${OWNER}. Store: ${[c.address, c.postal].filter(Boolean).join(", ") || "[address]"}.`] },
        { h: "Orders", p: ["Placing an order is an offer to buy. We confirm it when we accept it; we may decline or cancel an order, for example when an item is out of stock or a price or payment cannot be verified, and we will refund any money already paid."] },
        { h: "Prices", p: ["All prices are in Egyptian pounds (EGP). The price you pay is the one shown at checkout, calculated by our system, plus the delivery fee for your governorate. [Lawyer: confirm VAT presentation.]"] },
        { h: "Payment", p: ["See the payment methods page. An InstaPay order is confirmed after we verify your receipt; unpaid orders may expire and release the stock."] },
        { h: "Delivery, returns and exchanges", p: ["See the shipping and returns pages, which form part of these terms."] },
        { h: "Product information", p: ["We try to show colours and details accurately; screens differ slightly. [Owner: do not describe a product as original or authentic unless you can document it.]"] },
        { h: "Consumer rights and disputes", p: ["Nothing here limits rights you have under Egyptian Consumer Protection Law No. 181 of 2018. [Lawyer: confirm governing law, complaint route and court wording.]"] },
        { h: "Changes", p: ["We may update these terms; the version shown when you order applies to that order."] },
      ] };
    case "returns": return {
      title: "Returns & exchanges", description: "Returns and exchange policy of AKM Luxury Shoes.", storeText: c.storeText.returns,
      sections: [
        { h: "Policy", p: ["[Owner: state your return/exchange window, item condition (unworn, original box, tags), who pays return delivery, and how refunds are made — in the same method as payment or store credit.]", "[Lawyer: confirm the minimum return rights that apply under Consumer Protection Law No. 181 of 2018.]"] },
        { h: "Defective or wrong items", p: ["If you receive a damaged, defective or wrong item, contact us as soon as possible with your order number and photos."] },
        { h: "How to start a return", p: [`Contact us${c.whatsapp ? " on WhatsApp" : ""}${c.phone ? ` at ${c.phone}` : ""}${c.email ? ` or ${c.email}` : ""} with your order number.`] },
      ] };
    case "shipping": return {
      title: "Shipping", description: "Delivery areas, fees and times for AKM Luxury Shoes.", storeText: c.storeText.shipping,
      sections: [
        { h: "Where we deliver", p: ["We deliver across Egypt. The delivery fee depends on your governorate and is shown at checkout before you place the order. [Owner: review the fee for every governorate before launch.]"] },
        { h: "Delivery time", p: ["[Owner: state estimated delivery time for Alexandria and for other governorates, and which courier you use.]"] },
        { h: "On delivery", p: ["Please keep your phone on: the courier calls before delivery. For cash on delivery, have the exact total ready. [Owner: state whether customers may open the parcel before paying.]"] },
        { h: "Tracking", p: ["Track your order with your order number and phone number on the Track page."] },
      ] };
    case "payment": return {
      title: "Payment methods", description: "How you can pay at AKM Luxury Shoes.", 
      sections: [
        ...(c.cod ? [{ h: "Cash on delivery", p: ["Pay the courier in cash when the order arrives."] }] : []),
        ...(c.instapayOn ? [{ h: "InstaPay", p: [`Transfer the exact total to ${c.instapay ? `InstaPay number ${c.instapay}` : "our InstaPay account"}, then upload the receipt on the order page. We check it and then prepare your order. Orders that are not paid in time may expire.`] }] : []),
        ...(c.card ? [{ h: "Visa / Mastercard", p: ["You pay on our payment provider’s secure page. We never see or store your card number."] }] : []),
        { h: "Prices", p: ["All prices are in Egyptian pounds (EGP)."] },
      ] };
    case "contact": return {
      title: "Contact us", description: "Visit or contact AKM Luxury Shoes in Alexandria.",
      sections: [
        { h: "Store", p: [[c.address, c.postal].filter(Boolean).join(", ") || "[address]"] },
        { h: "Get in touch", p: [c.phone && `Phone: ${c.phone}`, c.email && `Email: ${c.email}`, c.whatsapp && `WhatsApp: +${c.whatsapp}`, ...c.social.map(([n, u]) => `${n}: ${u}`)].filter((x): x is string => !!x) },
      ] };
  }
}
