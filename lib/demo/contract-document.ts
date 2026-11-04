import type { BusinessContract } from "./business-types";

export const contractLegalSources = [
  { title: "Constitution, Article 44 (English reference translation, 2008 edition)",
    url: "https://www.constituteproject.org/constitution/Cambodia_2008" },
  { title: "Civil Code — JICA English reference translation (not a consolidated legal opinion)",
    url: "https://www.jica.go.jp/project/cambodia/0701047/04/ku57pq00001spnva-att/01_02e.pdf" },
  { title: "JICA legal cooperation portal — Khmer and English texts",
    url: "https://www.jica.go.jp/activities/issues/governance/portal/cambodia/index.html" },
] as const;
export const contractTemplateVersion = "KANTARA-DRAFT-2026-11-04-v1";

export function escapeDocumentText(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}
export function contractDocumentHtml(contract: BusinessContract, khmerFontBase64?: string, production = false): string {
  const fr = contract.language === "fr-km";
  const choose = (french: string, english: string) => fr ? french : english;
  const title = contract.kind === "SALE_MANDATE"
    ? choose("Mandat de vente", "Sale agency mandate")
    : contract.kind === "RENTAL_MANDATE" ? choose("Mandat de location", "Rental agency mandate")
      : choose("Bail de location résidentielle", "Residential lease");
  const khmerTitle = contract.kind === "SALE_MANDATE" ? "កិច្ចសន្យាអាណត្តិលក់អចលនទ្រព្យ"
    : contract.kind === "RENTAL_MANDATE" ? "កិច្ចសន្យាអាណត្តិជួលអចលនទ្រព្យ" : "កិច្ចសន្យាជួលលំនៅឋាន";
  const e = escapeDocumentText;
  const field = (label: string, khmer: string, value: string) =>
    `<div class="field"><dt>${e(label)}<span lang="km">${e(khmer)}</span></dt><dd>${e(value)}</dd></div>`;
  const paragraph = (primary: string, khmer: string) => `<p>${e(primary)}</p><p lang="km">${e(khmer)}</p>`;
  const owner = contract.ownerSnapshot;
  const tenant = contract.counterpartySnapshot;
  const partyFields = (person: typeof owner) =>
    field(choose("Nom et qualité", "Name and role"), "ឈ្មោះ និងតួនាទី", `${person.name} — ${person.role}`)
    + field(choose("Adresse", "Address"), "អាសយដ្ឋាន", person.address)
    + field(choose("Référence d’identité déclarée", "Declared identity reference"), "លេខយោងអត្តសញ្ញាណដែលបានប្រកាស", person.identityReference)
    + field(choose("Nationalité déclarée", "Declared nationality"), "សញ្ជាតិដែលបានប្រកាស", person.nationality)
    + field(choose("Coordonnées", "Contact details"), "ព័ត៌មានទំនាក់ទំនង", `${person.email} ${person.phone}`.trim() || "—");
  return `<!doctype html><html lang="${fr ? "fr" : "en"}"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:;">
<title>${e(title)}</title><style>
@page{size:A4;margin:18mm 16mm 20mm}body{font-family:Arial,"Khmer MN","Noto Sans Khmer",sans-serif;font-size:10pt;line-height:1.55;color:#173c32}
${khmerFontBase64 ? `@font-face{font-family:KantaraKhmer;src:url(data:font/ttf;base64,${khmerFontBase64}) format('truetype');font-weight:400;font-style:normal}` : ""}
[lang=km]{font-family:KantaraKhmer,"Noto Sans Khmer","Khmer MN",sans-serif;line-height:1.9}
h1{font-size:23pt;margin:8px 0}h2{font-size:14pt;border-bottom:1px solid #bdab7c;padding-bottom:7px;margin-top:24px}
h3{font-size:12pt}.brand{letter-spacing:4px;color:#8a692f}.notice{padding:12px;border:2px solid #8a692f;background:#faf8f3}
.field{display:grid;grid-template-columns:46% 54%;border-bottom:1px solid #ddd;padding:7px 0;break-inside:avoid}
dt span{display:block;font-size:9pt}dd{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}p{white-space:pre-wrap;overflow-wrap:anywhere}
.section{break-before:page}.property{break-inside:avoid;margin-bottom:20px}a{color:#173c32;overflow-wrap:anywhere}
.draft{font-weight:bold;font-size:12pt}.signature{margin-top:30px;border-top:1px dashed #999;padding-top:10px}
</style></head><body>
<div class="brand">KANTARA${production ? "" : " · DEMO"}</div><h1>${e(title)}</h1><h2 lang="km">${khmerTitle}</h2>
<div class="notice"><div class="draft">${choose("BROUILLON — NON VALIDÉ — NE PAS SIGNER", "DRAFT — NOT VALIDATED — DO NOT SIGN")}</div>
${paragraph(choose(
  "Données de démonstration uniquement. Ce modèle n’est ni un conseil juridique ni un document prêt à signer. Le texte khmer, les pouvoirs, le titre, la fiscalité et les formalités doivent être validés par un juriste cambodgien avant toute utilisation réelle. La date de signature ci-dessous est une date prévue, pas une preuve de signature.",
  "Demonstration data only. This template is not legal advice or a ready-to-sign instrument. Khmer wording, authority, title, taxes and formalities require Cambodian legal review before real use. The signing date below is planned, not proof of signature."),
  "ទិន្នន័យសម្រាប់ការបង្ហាញតែប៉ុណ្ណោះ។ សេចក្តីព្រាងនេះមិនមែនជាដំបូន្មានច្បាប់ ឬឯកសារត្រៀមចុះហត្ថលេខាទេ។ ត្រូវឱ្យអ្នកច្បាប់កម្ពុជាពិនិត្យអត្ថបទខ្មែរ សិទ្ធិ តម្លៃពន្ធ និងបែបបទមុនប្រើប្រាស់ពិត។ កាលបរិច្ឆេទចុះហត្ថលេខាគឺជាកាលបរិច្ឆេទគ្រោង មិនមែនភស្តុតាងនៃហត្ថលេខាទេ។")}</div>
<dl>${field(choose("Référence du document", "Document reference"), "លេខយោងឯកសារ", contract.id)}
${field(choose("Version et création", "Version and creation"), "កំណែ និងការបង្កើត", `${contractTemplateVersion} · ${contract.createdAt}`)}
${field(choose("Date et lieu prévus de signature", "Planned signing date and place"), "កាលបរិច្ឆេទ និងទីកន្លែងគ្រោងចុះហត្ថលេខា", `${contract.signedAt} · ${contract.signedPlace}`)}
${field(choose("Début / fin", "Start / end"), "ចាប់ផ្តើម / បញ្ចប់", `${contract.startDate} / ${contract.endDate}`)}</dl>
<h2>${choose("Propriétaire / mandant", "Owner / mandator")} · <span lang="km">ម្ចាស់ / អ្នកប្រគល់អាណត្តិ</span></h2>
<dl>${partyFields(owner)}</dl>
${tenant ? `<h2>${choose("Locataire", "Tenant")} · <span lang="km">អ្នកជួល</span></h2><dl>${partyFields(tenant)}</dl>` : ""}
<h2>${choose("Agence / mandataire", "Agency / mandatary")} · <span lang="km">ភ្នាក់ងារ / អ្នកទទួលអាណត្តិ</span></h2>
<dl>${field(choose("Nom", "Name"), "ឈ្មោះ", contract.agencyName)}
${field(choose("Adresse", "Address"), "អាសយដ្ឋាន", contract.agencyAddress)}
${field(choose("Référence d’enregistrement déclarée", "Declared registration reference"), "លេខយោងចុះបញ្ជីដែលបានប្រកាស", contract.agencyRegistration)}</dl>
<section class="section"><h2>${choose("Biens et conditions financières", "Properties and financial terms")} · <span lang="km">អចលនទ្រព្យ និងលក្ខខណ្ឌហិរញ្ញវត្ថុ</span></h2>
${contract.lines.map((line) => {
    const property = contract.propertySnapshots.find((item) => item.id === line.propertyId)!;
    return `<article class="property"><h3>${e(property.title)}</h3><dl>
${field(choose("Référence et adresse", "Reference and address"), "លេខយោង និងអាសយដ្ឋាន", `${property.id} · ${property.address}`)}
${field(choose("Titre déclaré — à vérifier", "Declared title — verification required"), "ប័ណ្ណកម្មសិទ្ធិដែលបានប្រកាស ត្រូវផ្ទៀងផ្ទាត់", property.titleReference)}
${field(choose("Surface / chambres / pièces", "Area / bedrooms / rooms"), "ផ្ទៃក្រឡា / បន្ទប់គេង / បន្ទប់", `${property.area} m² / ${property.bedrooms} / ${property.rooms}`)}
${field(contract.kind === "SALE_MANDATE" ? choose("Prix demandé", "Asking sale price") : choose("Loyer mensuel", "Monthly rent"), contract.kind === "SALE_MANDATE" ? "តម្លៃលក់" : "ថ្លៃជួលប្រចាំខែ", `${line.price} USD`)}
${field(choose("Commission prévisionnelle de l’agence", "Expected agency commission"), "កម្រៃជើងសាររំពឹងទុករបស់ភ្នាក់ងារ", `${line.expectedCommission} USD`)}</dl></article>`;
  }).join("")}
<dl>${field(choose("Exclusivité (mandats uniquement)", "Exclusivity (mandates only)"), "អាណត្តិផ្តាច់មុខ", contract.kind === "LEASE" ? "—" : contract.exclusive ? choose("Oui, sous réserve de validation des conditions", "Yes, subject to review of terms") : choose("Non", "No"))}
${contract.kind === "LEASE" ? field(choose("Dépôt total / jour d’échéance mensuel", "Total deposit / monthly due day"), "ប្រាក់កក់សរុប / ថ្ងៃបង់ប្រចាំខែ", `${contract.deposit} USD / ${contract.rentDueDay}`) : ""}
${field(choose("Usage autorisé / mission confiée", "Permitted use / scope of agency"), "ការប្រើប្រាស់អនុញ្ញាត / វិសាលភាពអាណត្តិ", contract.permittedUse)}
${field(choose("Conditions de commission et exigibilité", "Commission terms and due event"), "លក្ខខណ្ឌកម្រៃជើងសារ និងពេលត្រូវបង់", contract.commissionTerms)}
${field(choose("Conditions particulières", "Specific terms"), "លក្ខខណ្ឌពិសេស", contract.terms)}</dl>
${paragraph(choose("Les champs libres sont reproduits dans leur langue de saisie, sans traduction automatique ni validation. Préciser charges, réparations, inventaire, restitution du dépôt, résiliation, notifications et litiges selon le type de contrat. Aucune signature, vente foncière, perception ou commission légale n’est créée par ce PDF.",
  "Free-text fields are reproduced in their input language, without automatic translation or validation. Specify utilities, repairs, inventory, deposit return, termination, notices and disputes as appropriate. This PDF does not create a signature, land transfer, payment or statutory commission."),
  "វាលអត្ថបទសេរីបង្ហាញតាមភាសាដែលបានបញ្ចូល ដោយមិនបកប្រែឬផ្ទៀងផ្ទាត់ដោយស្វ័យប្រវត្តិ។ ត្រូវបញ្ជាក់បន្ទុកចំណាយ ការជួសជុល បញ្ជីសម្ភារៈ ការសងប្រាក់កក់ ការបញ្ចប់ ការជូនដំណឹង និងវិវាទ។ PDF នេះមិនបង្កើតហត្ថលេខា ការផ្ទេរដី ការទូទាត់ ឬកម្រៃជើងសារតាមច្បាប់ទេ។")}</section>
<section class="section"><h2>${choose("Repères juridiques cambodgiens — résumés non exhaustifs", "Cambodian legal reference points — non-exhaustive summaries")}</h2><h3 lang="km">ចំណុចយោងច្បាប់កម្ពុជា សេចក្តីសង្ខេបមិនពេញលេញ</h3>
${paragraph(choose("Constitution, art. 44 : l’accès à la propriété foncière est soumis à des conditions de nationalité. Vérifier la capacité et la nature exacte du droit ; ce modèle ne présume pas l’éligibilité d’un acquéreur et ne couvre pas les régimes spéciaux de copropriété étrangère.",
  "Constitution, art. 44: land ownership is subject to nationality conditions. Verify legal capacity and the precise right; this template does not assume buyer eligibility or cover special foreign co-ownership regimes."),
  "រដ្ឋធម្មនុញ្ញ មាត្រា 44៖ កម្មសិទ្ធិដីធ្លីស្ថិតក្រោមលក្ខខណ្ឌសញ្ជាតិ។ ត្រូវផ្ទៀងផ្ទាត់សមត្ថភាព និងប្រភេទសិទ្ធិ។ សេចក្តីព្រាងនេះមិនសន្មតថាអ្នកទិញមានសិទ្ធិ និងមិនគ្របដណ្តប់របបកម្មសិទ្ធិបរទេសពិសេសទេ។")}
${contract.kind === "SALE_MANDATE" ? paragraph(choose("Code civil, art. 528–530 : distinguer le mandat de la vente et du transfert de droits ; vérifier titre, charges, limites et informations dues à l’acquéreur. Ce mandat ne transfère aucun droit foncier.",
  "Civil Code, arts. 528–530: distinguish agency from sale and transfer of rights; verify title, encumbrances, boundaries and buyer disclosures. This mandate transfers no land rights."),
  "ក្រមរដ្ឋប្បវេណី មាត្រា 528–530៖ ត្រូវបែងចែកអាណត្តិពីការលក់និងការផ្ទេរសិទ្ធិ ហើយពិនិត្យប័ណ្ណកម្មសិទ្ធិ បន្ទុក ព្រំដី និងព័ត៌មានសម្រាប់អ្នកទិញ។ អាណត្តិនេះមិនផ្ទេរសិទ្ធិដីធ្លីទេ។") : paragraph(choose("Code civil, art. 596–602 : définition et formation du bail, opposabilité, durée, usage, soin et réparations. L’art. 599 renvoie les locations immobilières de 15 ans ou plus au régime de l’art. 244 ; ces baux sont exclus de ce générateur.",
  "Civil Code, arts. 596–602: lease definition and formation, enforceability, term, use, care and repairs. Art. 599 refers immovable leases of 15 years or more to art. 244; these leases are excluded from this generator."),
  "ក្រមរដ្ឋប្បវេណី មាត្រា 596–602៖ និយមន័យ និងការបង្កើតកិច្ចសន្យាជួល អានុភាពចំពោះតតិយជន រយៈពេល ការប្រើប្រាស់ ការថែទាំ និងការជួសជុល។ មាត្រា 599 យោងការជួលអចលនវត្ថុចាប់ពី 15 ឆ្នាំទៅមាត្រា 244។ កម្មវិធីនេះមិនបង្កើតបែបបទជួលទាំងនោះទេ។")}
${contract.kind !== "LEASE" ? paragraph(choose("Code civil, art. 637–644 et 647 : mission du mandataire, rémunération convenue, diligence et compte rendu ; conditions de révocation à examiner. Aucune commission ni durée d’exclusivité ne doit être présentée comme un taux ou délai légal automatique.",
  "Civil Code, arts. 637–644 and 647: scope of mandate, agreed remuneration, care and reporting; termination conditions require review. No commission or exclusivity term is represented as an automatic statutory rate or period."),
  "ក្រមរដ្ឋប្បវេណី មាត្រា 637–644 និង 647៖ វិសាលភាពអាណត្តិ កម្រៃដែលបានព្រមព្រៀង ការប្រុងប្រយ័ត្ន និងការរាយការណ៍។ ត្រូវពិនិត្យលក្ខខណ្ឌបញ្ចប់អាណត្តិ។ មិនចាត់ទុកកម្រៃ ឬរយៈពេលផ្តាច់មុខជាអត្រា ឬកំណត់ពេលច្បាប់ស្វ័យប្រវត្តិទេ។") : ""}
${paragraph(choose("Sources consultées le 4 novembre 2026. Références de travail, non consolidées : vérifier textes khmers applicables, amendements, droit foncier, enregistrement, licences, fiscalité et réglementation locale avec le conseil compétent. Ni les clauses ni la traduction khmère ne sont certifiées.",
  "Sources consulted 4 November 2026. Non-consolidated working references: verify applicable Khmer texts, amendments, land law, registration, licensing, taxes and local regulation with qualified counsel. Neither clauses nor Khmer translation are certified."),
  "ប្រភពបានពិនិត្យនៅថ្ងៃទី 4 ខែវិច្ឆិកា ឆ្នាំ 2026។ ត្រូវផ្ទៀងផ្ទាត់អត្ថបទខ្មែរដែលអនុវត្ត ការកែប្រែ ច្បាប់ដីធ្លី ការចុះបញ្ជី អាជ្ញាបណ្ណ ពន្ធ និងបទប្បញ្ញត្តិមូលដ្ឋានជាមួយអ្នកច្បាប់។ លក្ខខណ្ឌ និងការបកប្រែខ្មែរមិនត្រូវបានបញ្ជាក់ទទួលស្គាល់ទេ។")}
<ol>${contractLegalSources.map((source) => `<li>${e(source.title)}<br><a href="${source.url}">${source.url}</a></li>`).join("")}</ol>
<div class="signature">${choose("Emplacements indicatifs : propriétaire / agence / locataire le cas échéant. BROUILLON NON SIGNABLE.", "Indicative placeholders: owner / agency / tenant where applicable. DRAFT NOT FOR SIGNING.")}<p lang="km">កន្លែងសម្គាល់សម្រាប់ម្ចាស់ ភ្នាក់ងារ និងអ្នកជួលបើមាន។ សេចក្តីព្រាង មិនត្រូវចុះហត្ថលេខា។</p></div></section>
</body></html>`;
}
