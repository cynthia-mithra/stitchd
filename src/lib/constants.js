export const SUPABASE_URL = "https://zhstooqgkyuzxseylsbk.supabase.co";
export const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpoc3Rvb3Fna3l1enhzZXlsc2JrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NzM3MzQsImV4cCI6MjA5NjE0OTczNH0.mW5GB1VzSfRBMWZRlU7OfQ0RqoT1wEBVBoai6dJ6eQs";
export const STRIPE_PK   = "pk_test_51TelKZPVRS43N0XeftXWJNSr9wLp2Q5REYAkq1ABO0ztePMTP4zw6QHR4gN0o6nqWkZH66zYKRicGrgJvuQLywwo00oKnn5ydj";
export const PLATFORM_FEE = 0.05;
export const hdrs = (t) => ({ apikey: SUPABASE_KEY, Authorization: `Bearer ${t||SUPABASE_KEY}`, "Content-Type": "application/json" });

export function buildPaymentSummary(listing) {
  const amount = parseFloat(listing.price);
  const fee    = parseFloat((amount * PLATFORM_FEE).toFixed(2));
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
export const CARD_COLORS= ["#FF1493","#FF9500","#34C759","#007AFF","#BF5AF2","#FF2D55","#FF6B00","#0A84FF"];
export const EMPTY_FORM = {name:"",price:"",condition:"Like New",listing_type:"Clothing",category:"Saree",origin:"Indian",fabric:"Silk",material:"",size:"Free Size",occasions:[],gender:"women",meas_unit:"cm",garment_type:"",meas:{},additional_measurements:"",bust:"",waist:"",hips:"",length:"",underbust:"",shoulder:"",high_hip:"",sleeve_length:"",inseam:"",measurement_notes:"",can_take_in:false,spare_fabric:false,description:"",imageFiles:[],imagePreviews:[],postage_options:[],accepts_collection:false};

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

export const POSTAGE_OPTIONS = [
  {id:"evri",name:"Evri",emoji:"📦",prices:[{label:"Small parcel (up to 2kg)",price:3.99},{label:"Medium parcel (up to 5kg)",price:5.49},{label:"Large parcel (up to 15kg)",price:7.49}]},
  {id:"royal_mail",name:"Royal Mail",emoji:"📮",prices:[{label:"Tracked 48 (up to 2kg)",price:3.35},{label:"Tracked 24 (up to 2kg)",price:4.35},{label:"Special Delivery",price:7.85}]},
  {id:"inpost",name:"InPost",emoji:"🟡",prices:[{label:"Locker to Locker (up to 25kg)",price:2.99},{label:"Locker to Door (up to 25kg)",price:3.99}]},
  {id:"hermes",name:"Hermes",emoji:"🚚",prices:[{label:"Small parcel (up to 2kg)",price:3.49},{label:"Medium parcel (up to 5kg)",price:5.49}]},
  {id:"dpd",name:"DPD",emoji:"📬",prices:[{label:"Next day delivery",price:4.99},{label:"Two day delivery",price:3.99}]},
];

export const catEmoji = c=>({"Saree":"🥻","Salwar Kameez":"👘","Lehenga":"👗","Sherwani":"🧥","Kurta":"👕","Co-ord Set":"✨","Dupatta":"🧣","Accessories":"💍","Necklace":"📿","Earrings":"✨","Maang Tikka":"👑","Jhumka":"🔮","Bangles":"💛","Bracelet":"📿","Ring":"💍","Nose Ring":"✦","Anklet":"🦶","Haar":"📿","Choker":"📿","Full Set":"👑","Other Jewellery":"💎","Heels":"👠","Flats":"🥿","Sandals":"👡","Juttis":"✨","Khussa":"✨","Boots":"👢","Trainers":"👟","Wedges":"👠","Platforms":"👠","Other Shoes":"👠","Other":"🛍️"}[c]||"💎");
export const waLink   = (n,name,price)=>`https://wa.me/${n.replace(/\D/g,"")}?text=${encodeURIComponent(`Hi! I saw "${name}" (£${price}) on Stitch'd — still available?`)}`;
// Stitch'd is UK-only: all prices are displayed in GBP (£), regardless of any
// legacy currency code stored on a listing/profile. Payment-processing currency
// is handled separately in the Stripe call sites and is intentionally untouched.
export const currencySymbol = ()=>"£";
