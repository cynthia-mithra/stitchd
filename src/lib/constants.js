import { Package, Mailbox, Box, Truck } from "lucide-react";

export const SUPABASE_URL = "https://zhstooqgkyuzxseylsbk.supabase.co";
export const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpoc3Rvb3Fna3l1enhzZXlsc2JrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NzM3MzQsImV4cCI6MjA5NjE0OTczNH0.mW5GB1VzSfRBMWZRlU7OfQ0RqoT1wEBVBoai6dJ6eQs";
export const STRIPE_PK   = "pk_test_51TelKZPVRS43N0XeftXWJNSr9wLp2Q5REYAkq1ABO0ztePMTP4zw6QHR4gN0o6nqWkZH66zYKRicGrgJvuQLywwo00oKnn5ydj";
// Vinted-style fees: sellers sell FREE (no commission), and the BUYER pays a
// Buyer Protection fee at checkout (this is the platform's revenue). Fee is a
// fixed part + a % of the item subtotal.
export const PLATFORM_FEE = 0;            // seller commission (0 = sellers sell free)
export const BUYER_PROTECTION_FIXED = 0.80; // £ fixed part
export const BUYER_PROTECTION_PCT = 0.06;   // % of item subtotal
// Buyer Protection fee in pounds for a given item subtotal (in pounds).
export function buyerProtectionFee(subtotal) {
  const s = Number(subtotal) || 0;
  if (s <= 0) return 0;
  return parseFloat((BUYER_PROTECTION_FIXED + s * BUYER_PROTECTION_PCT).toFixed(2));
}
export const hdrs = (t) => ({ apikey: SUPABASE_KEY, Authorization: `Bearer ${t||SUPABASE_KEY}`, "Content-Type": "application/json" });

export function buildPaymentSummary(listing) {
  const amount = parseFloat(listing.price);
  const fee    = parseFloat((amount * PLATFORM_FEE).toFixed(2)); // 0 — sellers sell free
  const sellerGets = parseFloat((amount - fee).toFixed(2));
  return { amount, fee, sellerGets };
}

export const CATEGORIES   = ["Saree","Salwar Kameez","Lehenga","Sherwani","Kurta","Co-ord Set","Dupatta","Accessories","Other"];
export const JEWELLERY_CATS=["Necklace","Earrings","Maang Tikka","Jhumka","Bangles","Bracelet","Ring","Nose Ring","Anklet","Haar","Choker","Full Set","Other Jewellery"];
export const SHOE_CATS = ["Heels","Flats","Sandals","Juttis","Khussa","Boots","Trainers","Wedges","Platforms","Other Shoes"];
export const SHOE_SIZES = ["UK 2","UK 3","UK 4","UK 5","UK 6","UK 7","UK 8","UK 9","UK 10","EU 35","EU 36","EU 37","EU 38","EU 39","EU 40","EU 41","EU 42","US 5","US 6","US 7","US 8","US 9","US 10","US 11"];
export const ALL_CATEGORIES=[...CATEGORIES,...JEWELLERY_CATS,...SHOE_CATS];
export const LISTING_TYPES= ["Clothing","Jewellery","Shoes"];
export const JEWELLERY_MATERIALS=["Gold Plated","Silver Plated","Kundan","Polki","Meenakari","Pearl","Oxidised","Jadau","Stone","Artificial","Other"];
export const ORIGINS      = ["Indian","Pakistani","Bangladeshi","Sri Lankan","Nepali","Other"];
export const FABRICS      = ["Silk","Cotton","Chiffon","Georgette","Velvet","Brocade","Lawn","Net","Organza","Linen","Other"];
export const CONDITIONS = ["Brand New (with tags)","Brand New (without tags)","Like New","Excellent","Good","Fair","For Parts/Repair"];
export const OCCASIONS  = ["Wedding","Eid","Diwali","Mehndi","Nikah","Sangeet","Navratri","Puja","Party","Casual","Graduation","Other"];
export const SIZES      = ["XS","S","M","L","XL","XXL","Free Size","Custom Stitched"];
export const OCC_COLOR  = {Wedding:"#FF1493",Eid:"#34C759",Diwali:"#FF9500",Mehndi:"#30D158",Nikah:"#007AFF",Sangeet:"#FF2D55",Navratri:"#FF6B00",Puja:"#FF1493",Party:"#BF5AF2",Casual:"#8E8E93",Graduation:"#0A84FF",Other:"#636366"};
// ── Phase 12 — Colour filter ──────────────────────────────────────────────────
// Buyers filter listings by colour and sellers tag a listing with one or more
// colours. Stored in the `colours` text[] column (see the phase12 migration).
// COLOUR_HEX is the swatch fill for each colour; Multicolour is rendered as a
// conic-gradient (see colourSwatchBg) since it has no single hex.
export const COLOURS    = ["Red","Pink","Orange","Yellow","Green","Blue","Purple","Gold","Silver","White","Black","Cream","Multicolour"];
export const COLOUR_HEX = {Red:"#E0245E",Pink:"#FF1493",Orange:"#FF9500",Yellow:"#FFD60A",Green:"#34C759",Blue:"#007AFF",Purple:"#BF5AF2",Gold:"#D4AF37",Silver:"#C0C0C0",White:"#FFFFFF",Black:"#111111",Cream:"#F5E6C8",Multicolour:"#999999"};
// Background for a colour swatch. Multicolour gets a rainbow conic-gradient; every
// other colour is its flat hex. Used identically by the shop filter and the form.
export const colourSwatchBg = (c) => c==="Multicolour"
  ? "conic-gradient(from 90deg,#E0245E,#FF9500,#FFD60A,#34C759,#007AFF,#BF5AF2,#E0245E)"
  : (COLOUR_HEX[c]||"#999999");
export const CARD_COLORS= ["#FF1493","#FF9500","#34C759","#007AFF","#BF5AF2","#FF2D55","#FF6B00","#0A84FF"];
export const EMPTY_FORM = {name:"",price:"",condition:"Like New",listing_type:"Clothing",category:"Saree",origin:"Indian",fabric:"Silk",material:"",size:"Free Size",occasions:[],colours:[],gender:"women",meas_unit:"cm",garment_type:"",meas:{},additional_measurements:"",bust:"",waist:"",hips:"",length:"",underbust:"",shoulder:"",high_hip:"",sleeve_length:"",inseam:"",measurement_notes:"",can_take_in:false,spare_fabric:false,description:"",imageFiles:[],imagePreviews:[],postage_options:[],accepts_collection:false,offers_enabled:true,minimum_offer:""};

// ── Garment-specific measurement fields ───────────────────────────────────────
// Which measurement fields show depends on gender + garment type. Field labels
// are human-readable; on save they're stored verbatim in the `measurements` JSON
// (see buildMeasPayload) and, where they map to a legacy column, mirrored there
// too so the older Detail rendering and "Perfect fit" logic keep working.
export const WOMEN_GARMENTS = {
  "Saree":["Blouse bust","Blouse waist","Blouse length","Saree length","Blouse sleeve length"],
  "Lehenga":["Waist","Hip","Lehenga length","Blouse bust","Blouse waist","Blouse length"],
  "Salwar Kameez / Suit":["Bust","Waist","Hip","Kameez length","Sleeve length","Trouser waist","Trouser length"],
  "Anarkali":["Bust","Waist","Hip","Length (floor to shoulder)","Sleeve length"],
  "Sharara / Gharara":["Waist","Hip","Top length","Sleeve length","Sharara length"],
  "Dupatta / Stole":["Length","Width"],
  "Dress / Gown (Western)":["Bust","Waist","Hip","Length","Sleeve length"],
  "Jewellery / Accessories":[],
  "Other / General":["Bust","Waist","Hip","Length"],
};
export const MEN_GARMENTS = {
  "Sherwani":["Chest","Waist","Shoulder width","Sherwani length","Sleeve length","Trouser waist","Trouser length","Inseam"],
  "Kurta / Kurta Pyjama":["Chest","Waist","Shoulder width","Kurta length","Sleeve length","Pyjama waist","Pyjama length","Inseam"],
  "Nehru Jacket / Waistcoat":["Chest","Waist","Shoulder width","Jacket length"],
  "Indo-Western Suit":["Chest","Waist","Shoulder width","Jacket length","Sleeve length","Trouser waist","Trouser length","Inseam"],
  "Dhoti / Lungi":["Waist","Length"],
  "Accessories":[],
  "Other / General":["Chest","Waist","Hip","Length"],
};
export const garmentTypesFor = g => Object.keys(g==="men"?MEN_GARMENTS:WOMEN_GARMENTS);
export const garmentFieldsFor = (g,type) => ((g==="men"?MEN_GARMENTS:WOMEN_GARMENTS)[type])||[];

// Pick a sensible garment type for the existing category dropdown so the right
// fields appear without the seller having to re-pick a garment.
const WOMEN_CAT_MAP={Saree:"Saree",Lehenga:"Lehenga","Salwar Kameez":"Salwar Kameez / Suit",Dupatta:"Dupatta / Stole",Accessories:"Jewellery / Accessories","Co-ord Set":"Dress / Gown (Western)",Kurta:"Anarkali",Sherwani:"Other / General",Other:"Other / General"};
const MEN_CAT_MAP={Sherwani:"Sherwani",Kurta:"Kurta / Kurta Pyjama","Salwar Kameez":"Kurta / Kurta Pyjama","Co-ord Set":"Indo-Western Suit",Accessories:"Accessories",Dupatta:"Dhoti / Lungi",Saree:"Other / General",Lehenga:"Other / General",Other:"Other / General"};
export const defaultGarmentFor=(g,cat)=>(g==="men"?MEN_CAT_MAP:WOMEN_CAT_MAP)[cat]||"Other / General";

// Reverse mapping: Clothing listings no longer have a separate Category dropdown
// — the garment type IS the category. This picks the closest legacy `category`
// value so card labels, emoji, search and the Shop category filter keep working.
const GARMENT_CAT_MAP={
  "Saree":"Saree","Lehenga":"Lehenga","Salwar Kameez / Suit":"Salwar Kameez",
  "Anarkali":"Salwar Kameez","Sharara / Gharara":"Salwar Kameez","Dupatta / Stole":"Dupatta",
  "Dress / Gown (Western)":"Co-ord Set","Jewellery / Accessories":"Accessories",
  "Sherwani":"Sherwani","Kurta / Kurta Pyjama":"Kurta","Nehru Jacket / Waistcoat":"Other",
  "Indo-Western Suit":"Co-ord Set","Dhoti / Lungi":"Other","Accessories":"Accessories",
};
export const categoryForGarment=gt=>GARMENT_CAT_MAP[gt]||"Other";

// Field-label → legacy column. Used to keep top-level bust/waist/hips/etc filled
// for backward compatibility (fit matching, legacy detail view).
export const MEAS_LEGACY={"Bust":"bust","Chest":"bust","Blouse bust":"bust","Waist":"waist","Hip":"hips","Hips":"hips","Length":"length","Length (floor to shoulder)":"length","Saree length":"length","Lehenga length":"length","Sherwani length":"length","Kurta length":"length","Sleeve length":"sleeve_length","Blouse sleeve length":"sleeve_length","Shoulder width":"shoulder","Inseam":"inseam"};

export const INCH_TO_CM = 2.54;
// Convert a stored value between units, rounded to 1 decimal. Non-numeric values
// (ranges, blanks) are returned unchanged so we never render "NaN".
export function convertMeasure(value, from, to){
  const n = parseFloat(value);
  if(isNaN(n)) return value;
  const cm = from==="inches" ? n*INCH_TO_CM : n;
  const out = to==="inches" ? cm/INCH_TO_CM : cm;
  return Math.round(out*10)/10;
}

// Parse the `measurements` column whether it comes back as an object or a JSON
// string (PostgREST returns jsonb as an object; a text column as a string).
export function parseMeasurements(item){
  let m=item&&item.measurements;
  if(typeof m==="string"){ try{ m=JSON.parse(m); }catch(e){ m=null; } }
  return m&&typeof m==="object"&&!Array.isArray(m)?m:null;
}

// Build the measurement-related slice of a listing payload from the form.
export function buildMeasPayload(form){
  const blank={bust:"",waist:"",hips:"",length:"",underbust:"",shoulder:"",high_hip:"",sleeve_length:"",inseam:""};
  if(form.listing_type!=="Clothing"){
    return {...blank,measurement_notes:"",measurements:null,measurements_unit:"",additional_measurements:""};
  }
  const gt=form.garment_type||defaultGarmentFor(form.gender,form.category);
  const fields=garmentFieldsFor(form.gender,gt);
  const values={};
  fields.forEach(l=>{ const v=form.meas&&form.meas[l]; if(v!=null&&String(v).trim()!=="") values[l]=String(v).trim(); });
  const legacy={...blank};
  fields.forEach(l=>{ const col=MEAS_LEGACY[l]; if(col&&values[l]&&!legacy[col]) legacy[col]=values[l]; });
  return {
    ...legacy,
    category:categoryForGarment(gt),
    measurement_notes:form.additional_measurements||"",
    measurements:{gender:form.gender,unit:form.meas_unit,garment:gt,values},
    measurements_unit:form.meas_unit,
    additional_measurements:form.additional_measurements||"",
  };
}

// Each carrier carries an `Icon` (a Lucide React component) rendered in the
// delivery picker instead of an emoji — see the PAYMENT MODAL in App.js.
export const POSTAGE_OPTIONS = [
  {id:"evri",name:"Evri",Icon:Package,prices:[{label:"Small parcel (up to 2kg)",price:3.99},{label:"Medium parcel (up to 5kg)",price:5.49},{label:"Large parcel (up to 15kg)",price:7.49}]},
  {id:"royal_mail",name:"Royal Mail",Icon:Mailbox,prices:[{label:"Tracked 48 (up to 2kg)",price:3.35},{label:"Tracked 24 (up to 2kg)",price:4.35},{label:"Special Delivery",price:7.85}]},
  {id:"inpost",name:"InPost",Icon:Box,prices:[{label:"Locker to Locker (up to 25kg)",price:2.99},{label:"Locker to Door (up to 25kg)",price:3.99}]},
  {id:"hermes",name:"Hermes",Icon:Truck,prices:[{label:"Small parcel (up to 2kg)",price:3.49},{label:"Medium parcel (up to 5kg)",price:5.49}]},
  {id:"dpd",name:"DPD",Icon:Truck,prices:[{label:"Next day delivery",price:4.99},{label:"Two day delivery",price:3.99}]},
];

// Build a "track your parcel" URL from a stored carrier label (e.g. "Evri ·
// Small parcel…") and a tracking number. Falls back to a Google search when the
// carrier isn't one we have a direct tracking page for.
const TRACK_URL = {
  "Evri":       (n) => `https://www.evri.com/track/parcel/${n}/details`,
  "Hermes":     (n) => `https://www.evri.com/track/parcel/${n}/details`,
  "Royal Mail": (n) => `https://www.royalmail.com/track-your-item#/tracking-results/${n}`,
  "InPost":     (n) => `https://inpost.co.uk/tracking?number=${n}`,
  "DPD":        (n) => `https://track.dpd.co.uk/parcels/${n}`,
};
// Whether prepaid label generation is live. Flip to true once a courier API key
// is set on the buy-label Edge Function (provider chosen via SHIPPING_PROVIDER).
// Until then the GENERATE LABEL action stays hidden and sellers enter tracking
// numbers by hand.
export const SHIPPING_LABELS_ENABLED = false;

// Rough parcel weight (grams) inferred from a postage option label's "up to Nkg"
// band, so a label call can be sized without asking the seller to weigh it. Falls
// back to 1kg when no band is present.
export function parcelWeightGrams(label) {
  const m = /up to\s*([\d.]+)\s*kg/i.exec(String(label || ""));
  if (m) return Math.round(parseFloat(m[1]) * 1000);
  return 1000;
}

export function trackingUrl(carrierLabel, number) {
  if (!number) return null;
  const name = String(carrierLabel || "").split("·")[0].trim();
  const enc = encodeURIComponent(number);
  const fn = TRACK_URL[name];
  return fn ? fn(enc) : `https://www.google.com/search?q=${encodeURIComponent((name ? name + " " : "") + "tracking " + number)}`;
}

// ── Phase 12 — Saved searches ──────────────────────────────────────────────────
// A saved search persists the buyer's live shop filters as a `filters` jsonb blob
// (see the phase12 saved_searches migration). buildSearchFilters snapshots the
// current filter state into that shape — omitting "All"/empty values so the blob
// only carries the criteria the buyer actually set. filterSummary renders a blob
// back into the "Lehenga · Pink · Wedding · Under £200" chip shown in the save
// modal, on the saved-searches page and inside the alert email (the Edge Function
// has its own copy of this so it stays dependency-free).
export function buildSearchFilters({ query, catFilter, sizeFilter, minPrice, maxPrice, typeFilter, condFilter, occFilter, colourFilter, verifiedOnly }) {
  const f = {};
  if (query && String(query).trim()) f.query = String(query).trim();
  if (catFilter && catFilter !== "All") f.category = catFilter;
  if (typeFilter && typeFilter !== "All") f.type = typeFilter;
  if (sizeFilter && sizeFilter !== "All") f.size = sizeFilter;
  if (condFilter && condFilter !== "All") f.condition = condFilter;
  if (minPrice !== "" && minPrice != null && !isNaN(Number(minPrice))) f.min_price = Number(minPrice);
  if (maxPrice !== "" && maxPrice != null && !isNaN(Number(maxPrice))) f.max_price = Number(maxPrice);
  if (Array.isArray(occFilter) && occFilter.length) f.occasion = [...occFilter];
  if (Array.isArray(colourFilter) && colourFilter.length) f.colour = [...colourFilter];
  if (verifiedOnly) f.verified_only = true;
  return f;
}

export function filterSummary(filters) {
  if (!filters || typeof filters !== "object") return "All listings";
  const parts = [];
  if (filters.query) parts.push(`“${filters.query}”`);
  if (filters.category) parts.push(filters.category);
  if (filters.type) parts.push(filters.type);
  if (filters.size) parts.push(filters.size);
  if (filters.condition) parts.push(filters.condition);
  (filters.colour || []).forEach(c => parts.push(c));
  (filters.occasion || []).forEach(o => parts.push(o));
  if (filters.verified_only) parts.push("Verified sellers");
  const hasMin = filters.min_price != null && filters.min_price !== "";
  const hasMax = filters.max_price != null && filters.max_price !== "";
  if (hasMin && hasMax) parts.push(`£${filters.min_price}–£${filters.max_price}`);
  else if (hasMax) parts.push(`Under £${filters.max_price}`);
  else if (hasMin) parts.push(`Over £${filters.min_price}`);
  return parts.length ? parts.join(" · ") : "All listings";
}

export const catEmoji = c=>({"Saree":"🥻","Salwar Kameez":"👘","Lehenga":"👗","Sherwani":"🧥","Kurta":"👕","Co-ord Set":"✨","Dupatta":"🧣","Accessories":"💍","Necklace":"📿","Earrings":"✨","Maang Tikka":"👑","Jhumka":"🔮","Bangles":"💛","Bracelet":"📿","Ring":"💍","Nose Ring":"✦","Anklet":"🦶","Haar":"📿","Choker":"📿","Full Set":"👑","Other Jewellery":"💎","Heels":"👠","Flats":"🥿","Sandals":"👡","Juttis":"✨","Khussa":"✨","Boots":"👢","Trainers":"👟","Wedges":"👠","Platforms":"👠","Other Shoes":"👠","Other":"🛍️"}[c]||"💎");
export const waLink   = (n,name,price)=>`https://wa.me/${n.replace(/\D/g,"")}?text=${encodeURIComponent(`Hi! I saw "${name}" (£${price}) on Stitch'd — still available?`)}`;
// Stitch'd is UK-only: all prices are displayed in GBP (£), regardless of any
// legacy currency code stored on a listing/profile. Payment-processing currency
// is handled separately in the Stripe call sites and is intentionally untouched.
export const currencySymbol = ()=>"£";

// ── Phase 15 — Tailor profiles ────────────────────────────────────────────────
// The specialism pills a tailor selects on application (Step 2) and that show on
// their public profile, and the turnaround-time options (Step 3). turnaround_days
// stores a single representative day count; turnaroundLabel maps it back to the
// human band for display ("Typically 3-5 days").
export const TAILOR_SPECIALISMS = [
  "Saree blouse stitching","Lehenga alterations","Sherwani tailoring",
  "Salwar kameez alterations","Bridal wear","Embroidery and embellishment",
  "Hem alterations","Taking in / letting out","Custom stitching from scratch",
  "General alterations",
];
export const TAILOR_TURNAROUND = [
  {label:"1-3 days",days:3},{label:"3-5 days",days:5},{label:"1 week",days:7},
  {label:"2 weeks",days:14},{label:"2+ weeks",days:21},
];
export const turnaroundLabel = (days) => {
  const m = TAILOR_TURNAROUND.find(o=>o.days===days);
  return m ? m.label : (days ? `${days} days` : "");
};

// ── Phase 15 — Request alterations on a listing ───────────────────────────────
// The alteration types a buyer can pick (Step 1 of the request flow). Each maps
// to zero or more tailor specialisms (from TAILOR_SPECIALISMS) so Step 2 can
// surface the most relevant tailors first. A type with no mapping (e.g. "Other")
// matches no specialism — when NOTHING matches the buyer's whole selection we
// fall back to showing every approved tailor (see tailorsForAlterations).
export const ALTERATION_TYPES = [
  "Take in / let out",
  "Hem adjustment",
  "Sleeve alteration",
  "Blouse alteration",
  "Embroidery addition",
  "Custom stitching",
  "General repair",
  "Other",
];

const ALTERATION_SPECIALISM_MAP = {
  "Take in / let out":   ["Taking in / letting out","General alterations"],
  "Hem adjustment":      ["Hem alterations","General alterations"],
  "Sleeve alteration":   ["General alterations"],
  "Blouse alteration":   ["Saree blouse stitching","General alterations"],
  "Embroidery addition": ["Embroidery and embellishment"],
  "Custom stitching":    ["Custom stitching from scratch","General alterations"],
  "General repair":      ["General alterations"],
  "Other":               [],
};

// The set of tailor specialisms relevant to the buyer's selected alterations.
export function specialismsForAlterations(selected = []) {
  const set = new Set();
  (selected || []).forEach(a => (ALTERATION_SPECIALISM_MAP[a] || []).forEach(s => set.add(s)));
  return [...set];
}

// Filter approved tailors to those whose specialisms overlap the buyer's
// selection. If no tailor matches (or the selection maps to no specialism), the
// caller should show ALL approved tailors — so this returns the matches and a
// flag indicating whether the match narrowed anything.
export function tailorsForAlterations(tailors = [], selected = []) {
  const wanted = new Set(specialismsForAlterations(selected));
  if (!wanted.size) return { matched: tailors, narrowed: false };
  const matched = (tailors || []).filter(t => (t.specialisms || []).some(s => wanted.has(s)));
  return matched.length ? { matched, narrowed: true } : { matched: tailors, narrowed: false };
}

// ── Phase 10e — Shop the Look helpers ─────────────────────────────────────────
// The Stitch'd admin account. Looks created by this account (or any profile with
// is_admin=true) are stamped created_by_type='admin' and show "Curated by
// Stitch'd". Set this to the admin's email to also recognise them by email; the
// is_admin profile flag is the primary mechanism (see the migration).
export const ADMIN_EMAIL = "";

// A look row comes back with its items embedded as `look_items`, each carrying an
// embedded `listings` row. Pull those listings out, ordered by `position`.
export function lookListings(look){
  if(!look||!Array.isArray(look.look_items)) return [];
  return [...look.look_items]
    .sort((a,b)=>(a.position??0)-(b.position??0))
    .map(li=>li.listings)
    .filter(Boolean);
}

// Total price of a look. `onlyAvailable` sums just the non-sold pieces (used for
// the "GET THE FULL LOOK" total and ADD ALL TO BAG); otherwise every piece.
export function lookTotal(listings,onlyAvailable=false){
  return (listings||[]).reduce((sum,l)=>(onlyAvailable&&l.sold)?sum:sum+(parseFloat(l.price)||0),0);
}

// Which genders a look covers, for the WOMEN / MEN filter on the /looks page.
// Uses each listing's measurements.gender when present, else infers from its
// category (Sherwani / Kurta read as men's; everything else women's).
const MEN_CATEGORIES = ["Sherwani","Kurta"];
export function listingGender(l){
  const g=parseMeasurements(l)?.gender;
  if(g==="men"||g==="women") return g;
  return MEN_CATEGORIES.includes(l.category)?"men":"women";
}
export function lookGenders(listings){
  return new Set((listings||[]).map(listingGender));
}
