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
export const EMPTY_FORM = {name:"",price:"",condition:"Like New",listing_type:"Clothing",category:"Saree",origin:"Indian",fabric:"Silk",material:"",size:"Free Size",occasions:[],bust:"",waist:"",hips:"",length:"",underbust:"",shoulder:"",high_hip:"",sleeve_length:"",inseam:"",measurement_notes:"",can_take_in:false,spare_fabric:false,description:"",imageFiles:[],imagePreviews:[],postage_options:[],accepts_collection:false};

export const POSTAGE_OPTIONS = [
  {id:"evri",name:"Evri",emoji:"📦",prices:[{label:"Small parcel (up to 2kg)",price:3.99},{label:"Medium parcel (up to 5kg)",price:5.49},{label:"Large parcel (up to 15kg)",price:7.49}]},
  {id:"royal_mail",name:"Royal Mail",emoji:"📮",prices:[{label:"Tracked 48 (up to 2kg)",price:3.35},{label:"Tracked 24 (up to 2kg)",price:4.35},{label:"Special Delivery",price:7.85}]},
  {id:"inpost",name:"InPost",emoji:"🟡",prices:[{label:"Locker to Locker (up to 25kg)",price:2.99},{label:"Locker to Door (up to 25kg)",price:3.99}]},
  {id:"hermes",name:"Hermes",emoji:"🚚",prices:[{label:"Small parcel (up to 2kg)",price:3.49},{label:"Medium parcel (up to 5kg)",price:5.49}]},
  {id:"dpd",name:"DPD",emoji:"📬",prices:[{label:"Next day delivery",price:4.99},{label:"Two day delivery",price:3.99}]},
];

export const catEmoji = c=>({"Saree":"🥻","Salwar Kameez":"👘","Lehenga":"👗","Sherwani":"🧥","Kurta":"👕","Co-ord Set":"✨","Dupatta":"🧣","Accessories":"💍","Necklace":"📿","Earrings":"✨","Maang Tikka":"👑","Jhumka":"🔮","Bangles":"💛","Bracelet":"📿","Ring":"💍","Nose Ring":"✦","Anklet":"🦶","Haar":"📿","Choker":"📿","Full Set":"👑","Other Jewellery":"💎","Heels":"👠","Flats":"🥿","Sandals":"👡","Juttis":"✨","Khussa":"✨","Boots":"👢","Trainers":"👟","Wedges":"👠","Platforms":"👠","Other Shoes":"👠","Other":"🛍️"}[c]||"💎");
export const waLink   = (n,name,price)=>`https://wa.me/${n.replace(/\D/g,"")}?text=${encodeURIComponent(`Hi! I saw "${name}" ($${price}) on Stitch'd — still available?`)}`;
export const currencySymbol = c=>({USD:"$",GBP:"£",EUR:"€",CAD:"CA$",AUD:"A$",AED:"AED ",PKR:"₨",INR:"₹",BDT:"৳"}[c]||"$");
