import type { DossierDocument } from "./dossiers";
import { escapeDocumentText as e, contractLegalSources } from "@/lib/demo/contract-document";

const titles: Record<DossierDocument["input"]["kind"], [string, string]> = {
  LEASE: ["Residential lease agreement", "កិច្ចសន្យាជួលលំនៅឋាន"],
  SALE_AGREEMENT: ["Property sale agreement", "កិច្ចសន្យាលក់អចលនទ្រព្យ"],
  PRELIMINARY_SALE: ["Preliminary property sale agreement", "កិច្ចព្រមព្រៀងបឋមលក់អចលនទ្រព្យ"],
  DEPOSIT_RECEIPT: ["Deposit acknowledgement", "លិខិតទទួលប្រាក់កក់"],
  HANDOVER: ["Property handover record", "កំណត់ហេតុប្រគល់ទទួលអចលនទ្រព្យ"],
  COMMISSION_STATEMENT: ["Agency commission statement", "របាយការណ៍កម្រៃជើងសារភ្នាក់ងារ"],
};
export function dossierDocumentHtml(document: DossierDocument, font: string) {
  const { input, property, owner, counterparty } = document;
  const [title, khmerTitle] = titles[input.kind];
  const field = (en: string, km: string, value: string) => `<div class="field"><dt>${e(en)}<span lang="km">${e(km)}</span></dt><dd>${e(value)}</dd></div>`;
  const pair = (en: string, km: string) => `<p>${e(en)}</p><p lang="km">${e(km)}</p>`;
  const person = (en: string, km: string, value: typeof owner) => `<h2>${en} · <span lang="km">${km}</span></h2><dl>`
    + field("Name", "ឈ្មោះ", value.name) + field("Address", "អាសយដ្ឋាន", value.address)
    + field("Identity reference", "លេខអត្តសញ្ញាណ", value.identityReference)
    + field("Declared nationality", "សញ្ជាតិដែលបានប្រកាស", value.nationality) + "</dl>";
  const sale = ["SALE_AGREEMENT", "PRELIMINARY_SALE"].includes(input.kind);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:;">
<title>${e(title)}</title><style>
@font-face{font-family:KantaraKhmer;src:url(data:font/ttf;base64,${font}) format('truetype')}
@page{size:A4;margin:18mm 16mm 22mm}body{font-family:Arial,sans-serif;font-size:10pt;line-height:1.55;color:#17334d}
[lang=km]{font-family:KantaraKhmer,sans-serif;line-height:1.9}h1{font-size:23pt}h2{font-size:14pt;border-bottom:1px solid #cbdce8;padding-bottom:8px;margin-top:24px}
.field{display:grid;grid-template-columns:45% 55%;border-bottom:1px solid #ddd;padding:8px 0;break-inside:avoid}
dt span{display:block}dd{margin:0}p,dd{white-space:pre-wrap;overflow-wrap:anywhere}.signature{margin-top:30px;break-inside:avoid}.section{break-before:page}
</style></head><body><p>KANTARA</p><h1>${e(title)}</h1><h2 lang="km">${khmerTitle}</h2><dl>
${field("Document reference / version", "លេខយោង / កំណែ", `${document.id} / ${document.version}`)}
${field("Date / place", "កាលបរិច្ឆេទ / ទីកន្លែង", `${input.date} / ${input.place}`)}</dl>
${person("Owner / seller / lessor", "ម្ចាស់ / អ្នកលក់ / ភតិបតី", owner)}
${person(property.transaction === "sale" ? "Buyer" : "Tenant", property.transaction === "sale" ? "អ្នកទិញ" : "អ្នកជួល", counterparty)}
<h2>Agency · <span lang="km">ភ្នាក់ងារ</span></h2><dl>
${field("Agency / registration", "ភ្នាក់ងារ / លេខចុះបញ្ជី", `${input.agencyName} / ${input.agencyRegistration}`)}
${field("Address / representative", "អាសយដ្ឋាន / អ្នកតំណាង", `${input.agencyAddress} / ${input.representative}`)}</dl>
<h2>Property and amounts · <span lang="km">អចលនទ្រព្យ និងចំនួនប្រាក់</span></h2><dl>
${field("Property / address", "អចលនទ្រព្យ / អាសយដ្ឋាន", `${property.title} / ${property.address}`)}
${field("Title document type / reference", "ប្រភេទប័ណ្ណ / លេខយោង", `${input.titleType} / ${input.titleReference}`)}
${field(input.kind === "COMMISSION_STATEMENT" ? "Commission stated (USD)" : property.transaction === "sale" ? "Agreed sale price (USD)" : "Monthly rent (USD)", "ចំនួនប្រាក់ (ដុល្លារ)", input.price)}
${field("Deposit (USD)", "ប្រាក់កក់ (ដុល្លារ)", input.deposit)}
${input.kind === "LEASE" ? field("Lease start / end / monthly due day", "ចាប់ផ្តើម / បញ្ចប់ / ថ្ងៃបង់ប្រចាំខែ", `${input.startDate} / ${input.endDate} / ${input.rentDueDay}`) : ""}</dl>
${sale ? pair("The seller and buyer agree to the property transaction subject to the conditions below and applicable Cambodian requirements. This agreement does not itself register or transfer land ownership. Title, encumbrances, boundaries, authority and buyer eligibility must be verified; applicable registration and tax formalities remain necessary.",
"អ្នកលក់ និងអ្នកទិញព្រមព្រៀងលើប្រតិបត្តិការអចលនទ្រព្យតាមលក្ខខណ្ឌខាងក្រោម និងច្បាប់កម្ពុជាដែលអនុវត្ត។ កិច្ចព្រមព្រៀងនេះមិនចុះបញ្ជី ឬផ្ទេរកម្មសិទ្ធិដីធ្លីដោយខ្លួនឯងទេ។ ត្រូវផ្ទៀងផ្ទាត់ប័ណ្ណកម្មសិទ្ធិ បន្ទុក ព្រំដី សិទ្ធិតំណាង និងសិទ្ធិអ្នកទិញ ព្រមទាំងបំពេញបែបបទចុះបញ្ជី និងពន្ធ។") : ""}
${input.kind === "PRELIMINARY_SALE" ? pair("The parties must specify conditions precedent, completion deadline, deposit custody, refund/forfeiture conditions and remedies in both language versions below. This preliminary agreement does not certify completion.",
"ភាគីត្រូវបញ្ជាក់លក្ខខណ្ឌជាមុន កាលកំណត់បញ្ចប់ អ្នករក្សាប្រាក់កក់ លក្ខខណ្ឌសង ឬបាត់បង់ប្រាក់កក់ និងដំណោះស្រាយជាភាសាទាំងពីរខាងក្រោម។ កិច្ចព្រមព្រៀងបឋមនេះមិនបញ្ជាក់ការបញ្ចប់ប្រតិបត្តិការទេ។") : ""}
${input.kind === "LEASE" ? pair("The lessor grants use of the identified property to the tenant for the stated term and rent, subject to the terms below and mandatory Cambodian law. Specify permitted use, inventory, utilities, repairs, deposit return, notice, termination and dispute arrangements below.",
"ភតិបតីអនុញ្ញាតឱ្យអ្នកជួលប្រើប្រាស់អចលនទ្រព្យតាមរយៈពេល និងថ្លៃឈ្នួលដែលបានកំណត់ ដោយគោរពលក្ខខណ្ឌខាងក្រោម និងច្បាប់កម្ពុជាដែលមានអានុភាពបង្ខំ។ ត្រូវបញ្ជាក់ការប្រើប្រាស់ បញ្ជីសម្ភារៈ ចំណាយ ការជួសជុល ការសងប្រាក់កក់ ការជូនដំណឹង ការបញ្ចប់ និងវិវាទ។") : ""}
${input.kind === "DEPOSIT_RECEIPT" ? pair("This acknowledgement records the deposit and payment circumstances described below when signed by the actual recipient. Specify recipient, payer, payment date, method, reference, custody and refund conditions. It is not a bank verification or an agency commission receipt.",
"លិខិតនេះកត់ត្រាប្រាក់កក់ និងស្ថានភាពទូទាត់ខាងក្រោម នៅពេលអ្នកទទួលប្រាក់ពិតចុះហត្ថលេខា។ ត្រូវបញ្ជាក់អ្នកទទួល អ្នកបង់ កាលបរិច្ឆេទ វិធីបង់ លេខយោង ការរក្សា និងលក្ខខណ្ឌសង។ នេះមិនមែនជាការផ្ទៀងផ្ទាត់ធនាគារ ឬបង្កាន់ដៃកម្រៃភ្នាក់ងារទេ។") : ""}
${input.kind === "HANDOVER" ? pair("Record the actual handover date, keys, meter readings, inventory, condition, defects and outstanding obligations below. Signatures acknowledge the recorded handover, not a transfer of registered ownership.",
"កត់ត្រាកាលបរិច្ឆេទប្រគល់ពិត សោ លេខកុងទ័រ បញ្ជីសម្ភារៈ ស្ថានភាព កំហូច និងកាតព្វកិច្ចនៅសល់ខាងក្រោម។ ហត្ថលេខាបញ្ជាក់ការប្រគល់ដែលបានកត់ត្រា មិនមែនការផ្ទេរកម្មសិទ្ធិដែលបានចុះបញ្ជីទេ។") : ""}
${input.kind === "COMMISSION_STATEMENT" ? pair("This statement describes the agreed agency fee, payer, taxable treatment and due event in the terms below. It is not proof of receipt or a tax invoice. Commission is marked received in the CRM only after administrator reconciliation of the bank transfer.",
"របាយការណ៍នេះពិពណ៌នាកម្រៃភ្នាក់ងារ អ្នកបង់ ការគិតពន្ធ និងពេលត្រូវបង់តាមលក្ខខណ្ឌខាងក្រោម។ នេះមិនមែនភស្តុតាងទទួលប្រាក់ ឬវិក្កយបត្រពន្ធទេ។ CRM កត់ត្រាកម្រៃថាបានទទួល តែក្រោយអ្នកគ្រប់គ្រងផ្ទៀងផ្ទាត់ការផ្ទេរធនាគារ។") : ""}
<h2>Agreed terms · <span lang="km">លក្ខខណ្ឌដែលបានព្រមព្រៀង</span></h2>${pair(input.termsEnglish, input.termsKhmer)}
<section class="section"><h2>Applicable law and formalities · <span lang="km">ច្បាប់ និងបែបបទ</span></h2>
${pair("Mandatory Cambodian law prevails. Land ownership eligibility is governed in particular by Constitution Article 44; the precise title and any applicable special regime require verification. Leases and agency arrangements are subject to applicable Civil Code provisions. Neither these clauses nor their Khmer wording are certified. The parties must obtain Cambodian professional review before signing and complete the applicable formalities.",
"ច្បាប់កម្ពុជាដែលមានអានុភាពបង្ខំមានអាទិភាព។ សិទ្ធិកាន់កាប់កម្មសិទ្ធិដីធ្លីស្ថិតក្រោមរដ្ឋធម្មនុញ្ញមាត្រា ៤៤ ហើយត្រូវផ្ទៀងផ្ទាត់ប័ណ្ណ និងរបបពិសេសដែលអនុវត្ត។ កិច្ចសន្យាជួល និងអាណត្តិស្ថិតក្រោមក្រមរដ្ឋប្បវេណីដែលអនុវត្ត។ លក្ខខណ្ឌ និងអត្ថបទខ្មែរមិនត្រូវបានបញ្ជាក់ទទួលស្គាល់ទេ។ ភាគីត្រូវឱ្យអ្នកជំនាញកម្ពុជាពិនិត្យមុនចុះហត្ថលេខា និងបំពេញបែបបទចាំបាច់។")}
<ul>${contractLegalSources.map((source) => `<li>${e(source.title)}<br>${e(source.url)}</li>`).join("")}</ul>
<div class="signature"><h2>Signatures · <span lang="km">ហត្ថលេខា</span></h2>
${[owner.name, counterparty.name, `${input.agencyName} / ${input.representative}`].map((name) =>
    `<dl>${field("Name / capacity", "ឈ្មោះ / តួនាទី", name)}${field("Signature / date / place", "ហត្ថលេខា / កាលបរិច្ឆេទ / ទីកន្លែង", "\n\n____________________________")}</dl>`).join("")}
</div></section></body></html>`;
}
