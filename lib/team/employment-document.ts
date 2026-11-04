import type { Candidate } from "./schema";
import { escapeDocumentText as e } from "@/lib/demo/contract-document";

export function employmentDocumentHtml(contract: NonNullable<Candidate["contract"]>, font: string) {
  const { input: c, employee: p } = contract;
  const field = (en: string, km: string, value: string) => `<div class="field"><dt>${e(en)}<span lang="km">${e(km)}</span></dt><dd>${e(value)}</dd></div>`;
  const pair = (en: string, km: string) => `<p>${e(en)}</p><p lang="km">${e(km)}</p>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:;">
<title>Indefinite-term employment agreement — DRAFT</title><style>
@font-face{font-family:KantaraKhmer;src:url(data:font/ttf;base64,${font}) format('truetype');font-weight:400}
@page{size:A4;margin:18mm 16mm 22mm}body{font-family:Arial,sans-serif;font-size:10pt;line-height:1.55;color:#17334d}
[lang=km]{font-family:KantaraKhmer,sans-serif;line-height:1.9}h1{font-size:22pt}h2{font-size:14pt;border-bottom:1px solid #cbdce8;padding-bottom:8px;margin-top:24px}
.notice{background:#fff3c9;border:2px solid #755b15;padding:14px}.field{display:grid;grid-template-columns:45% 55%;border-bottom:1px solid #ddd;padding:8px 0;break-inside:avoid}
dt span{display:block}dd{margin:0}p,dd{white-space:pre-wrap;overflow-wrap:anywhere}.section{break-before:page}.signature{margin-top:42px;border-top:1px dashed #888}
</style></head><body><p>KANTARA · FICTIONAL LOCAL DEMONSTRATION</p>
<h1>Indefinite-term employment agreement</h1><h2 lang="km">កិច្ចសន្យាការងារមិនកំណត់ថិរវេលា</h2>
<div class="notice"><strong>DRAFT — UNSIGNED — NOT LEGALLY VALIDATED — DO NOT SIGN</strong>
${pair("Fictional data only. This is an administrative drafting aid, not legal advice or a ready-to-sign employment contract. English and Khmer wording, employer capacity, remuneration and every mandatory employment term require review by a qualified Cambodian professional before actual use. No electronic signature or evidence of employment is created.",
"ទិន្នន័យសាកល្បងតែប៉ុណ្ណោះ។ នេះជាជំនួយរៀបចំសេចក្តីព្រាងរដ្ឋបាល មិនមែនជាដំបូន្មានច្បាប់ ឬកិច្ចសន្យាត្រៀមចុះហត្ថលេខាទេ។ អ្នកជំនាញកម្ពុជាត្រូវពិនិត្យអត្ថបទអង់គ្លេស និងខ្មែរ សមត្ថភាពនិយោជក ប្រាក់ឈ្នួល និងលក្ខខណ្ឌការងារចាំបាច់ទាំងអស់មុនប្រើប្រាស់ពិត។ មិនមានហត្ថលេខាអេឡិចត្រូនិក ឬភស្តុតាងការងារត្រូវបានបង្កើតទេ។")}</div>
<dl>${field("Reference / template / created", "លេខយោង / គំរូ / កាលបរិច្ឆេទ", `${contract.id} / ${contract.version} / ${contract.createdAt}`)}</dl>
<h2>1. Parties · <span lang="km">ភាគី</span></h2><dl>
${field("Employer", "និយោជក", c.employerName)}${field("Employer registration", "លេខចុះបញ្ជីនិយោជក", c.employerRegistration)}
${field("Employer address", "អាសយដ្ឋាននិយោជក", c.employerAddress)}${field("Authorized representative", "អ្នកតំណាងមានសិទ្ធិ", c.representative)}
${field("Employee", "និយោជិត", p.name)}${field("Employee address", "អាសយដ្ឋាននិយោជិត", p.address)}
${field("Declared ID / passport reference", "លេខអត្តសញ្ញាណប័ណ្ណ / លិខិតឆ្លងដែនដែលបានប្រកាស", p.identityReference)}</dl>
<h2>2. Duration, position and place · <span lang="km">ថិរវេលា តួនាទី និងទីកន្លែង</span></h2>
${pair("The proposed employment is for an indefinite term, with no fixed end date. No probation period is established by this draft. Any probation or additional condition must be separately reviewed and expressly agreed before signing.",
"ការងារដែលបានស្នើមានថិរវេលាមិនកំណត់ ដោយគ្មានកាលបរិច្ឆេទបញ្ចប់ជាក់លាក់។ សេចក្តីព្រាងនេះមិនកំណត់រយៈពេលសាកល្បងទេ។ រយៈពេលសាកល្បង ឬលក្ខខណ្ឌបន្ថែមណាមួយត្រូវពិនិត្យ និងព្រមព្រៀងច្បាស់លាស់មុនចុះហត្ថលេខា។")}
<dl>${field("Proposed start date", "កាលបរិច្ឆេទចាប់ផ្តើមដែលបានស្នើ", c.startDate)}${field("Position", "តួនាទី", c.position)}
${field("Workplace", "ទីកន្លែងធ្វើការ", c.workplace)}${field("Duties — English", "ភារកិច្ច — អង់គ្លេស", c.dutiesEnglish)}
${field("Duties — Khmer", "ភារកិច្ច — ខ្មែរ", c.dutiesKhmer)}</dl>
<div class="section"><h2>3. Remuneration and working time · <span lang="km">ប្រាក់ឈ្នួល និងម៉ោងធ្វើការ</span></h2><dl>
${field("Proposed gross monthly salary (USD)", "ប្រាក់ឈ្នួលប្រចាំខែមុនកាត់ដែលបានស្នើ (ដុល្លារ)", c.monthlySalary)}
${field("Monthly pay day", "ថ្ងៃបើកប្រាក់ប្រចាំខែ", String(c.payDay))}
${field("Proposed ordinary hours per week", "ម៉ោងការងារធម្មតាប្រចាំសប្តាហ៍ដែលបានស្នើ", String(c.weeklyHours))}
${field("Schedule — English", "កាលវិភាគ — អង់គ្លេស", c.workScheduleEnglish)}
${field("Schedule — Khmer", "កាលវិភាគ — ខ្មែរ", c.workScheduleKhmer)}</dl>
${pair("The payment frequency, deductions, tax, overtime, weekly rest and any commission or benefit arrangements must be checked against applicable Cambodian requirements and documented before signing. Displayed sales commissions in the demo are not contractual remuneration or a promise of payment.",
"ភាពញឹកញាប់នៃការបើកប្រាក់ ការកាត់ប្រាក់ ពន្ធ ការងារបន្ថែមម៉ោង ការឈប់សម្រាកប្រចាំសប្តាហ៍ និងការរៀបចំកម្រៃជើងសារ ឬអត្ថប្រយោជន៍ ត្រូវពិនិត្យតាមតម្រូវការកម្ពុជាដែលអនុវត្ត ហើយកត់ត្រាមុនចុះហត្ថលេខា។ កម្រៃជើងសារក្នុងការបង្ហាញមិនមែនជាប្រាក់ឈ្នួលតាមកិច្ចសន្យា ឬការសន្យាទូទាត់ទេ។")}
<h2>4. Leave and holidays · <span lang="km">ការឈប់សម្រាក និងថ្ងៃឈប់បុណ្យ</span></h2>
${pair(c.leaveEnglish, c.leaveKhmer)}
<h2>5. Termination and notice · <span lang="km">ការបញ្ចប់ និងការជូនដំណឹង</span></h2>
${pair(c.terminationEnglish, c.terminationKhmer)}
<h2>6. Mandatory protection and review · <span lang="km">ការការពារចាំបាច់ និងការពិនិត្យ</span></h2>
${pair("Mandatory Cambodian employment law prevails over inconsistent draft terms. Before signing, review the Labour Law and current implementing rules, paid leave and public holidays, social security and occupational safety, work authorization where applicable, confidentiality, non-discrimination, disciplinary procedure, seniority-related entitlements, termination compensation and dispute resolution. No statutory right is waived by this draft. The English and Khmer versions require consistency review; neither is declared legally controlling here.",
"ច្បាប់ការងារកម្ពុជាដែលមានអានុភាពបង្ខំមានអាទិភាពលើលក្ខខណ្ឌព្រាងដែលផ្ទុយគ្នា។ មុនចុះហត្ថលេខា ត្រូវពិនិត្យច្បាប់ការងារ និងបទប្បញ្ញត្តិអនុវត្តបច្ចុប្បន្ន ការឈប់សម្រាកមានប្រាក់ឈ្នួល ថ្ងៃឈប់បុណ្យ សន្តិសុខសង្គម សុវត្ថិភាពការងារ សិទ្ធិធ្វើការបើត្រូវការ ការរក្សាការសម្ងាត់ ការមិនរើសអើង នីតិវិធីវិន័យ អត្ថប្រយោជន៍អតីតភាព សំណងបញ្ចប់ការងារ និងការដោះស្រាយវិវាទ។ សេចក្តីព្រាងនេះមិនបោះបង់សិទ្ធិតាមច្បាប់ណាមួយទេ។ អត្ថបទអង់គ្លេស និងខ្មែរត្រូវពិនិត្យឱ្យស្របគ្នា ហើយមិនបានកំណត់ថាភាសាណាមានអាទិភាពផ្លូវច្បាប់នៅទីនេះទេ។")}
<p>Reference portal: Ministry of Labour and Vocational Training — https://www.mlvt.gov.kh/</p>
<div class="signature">${pair("Employer / Employee / Date — intentionally blank; unsigned demonstration draft.",
"និយោជក / និយោជិត / កាលបរិច្ឆេទ — ទុកទទេដោយចេតនា ជាសេចក្តីព្រាងសាកល្បងមិនទាន់ចុះហត្ថលេខា។")}</div></div></body></html>`;
}
