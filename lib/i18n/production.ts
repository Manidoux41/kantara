import { locales, type Locale } from "./routing";
type Row = readonly [string, string, string, string, string, string, string];
const rows = {
  properties: ["Properties", "Les biens", "អចលនទ្រព្យ", "房源", "物件", "Immobilien", "Inmuebles"],
  published: ["Published listings", "Annonces publiées", "បញ្ជីបានផ្សព្វផ្សាយ", "已发布房源", "公開物件", "Veröffentlichte Angebote", "Anuncios publicados"],
  collection: ["Explore the agency’s published properties.", "Explorez les biens publiés par l’agence.", "ស្វែងរកអចលនទ្រព្យរបស់ភ្នាក់ងារ។", "浏览中介发布的房源。", "当社の公開物件をご覧ください。", "Entdecken Sie die veröffentlichten Immobilien.", "Explora los inmuebles publicados por la agencia."],
  results: ["{count} properties", "{count} biens", "{count} អចលនទ្រព្យ", "{count} 套房源", "{count} 件", "{count} Immobilien", "{count} inmuebles"],
  empty: ["No published property matches your search.", "Aucun bien publié ne correspond à votre recherche.", "មិនមានអចលនទ្រព្យត្រូវនឹងការស្វែងរក។", "没有符合条件的已发布房源。", "条件に合う公開物件はありません。", "Keine passenden veröffentlichten Angebote.", "No hay inmuebles publicados que coincidan."],
  illustration: ["Photographs are provided by the agency. A drawing is shown if no photograph is available.", "Les photos sont fournies par l’agence. Une illustration apparaît en l’absence de photo.", "រូបថតផ្តល់ដោយភ្នាក់ងារ។ ប្រើរូបគំនូរបើគ្មានរូបថត។", "照片由中介提供，无照片时显示插图。", "写真は当社提供です。写真のない場合はイラストを表示します。", "Fotos stellt die Agentur bereit. Ohne Foto erscheint eine Illustration.", "La agencia proporciona las fotos; sin foto se muestra una ilustración."],
  identity: ["Identity reference", "Référence d’identité", "លេខអត្តសញ្ញាណ", "证件编号", "本人確認番号", "Identitätsreferenz", "Referencia de identidad"],
  registration: ["Agency registration", "Enregistrement de l’agence", "លេខចុះបញ្ជីភ្នាក់ងារ", "中介注册号", "会社登録番号", "Agenturregistrierung", "Registro de la agencia"],
  saved: ["Saved in PostgreSQL.", "Enregistré dans PostgreSQL.", "រក្សាទុកក្នុង PostgreSQL។", "已保存至 PostgreSQL。", "PostgreSQLに保存しました。", "In PostgreSQL gespeichert.", "Guardado en PostgreSQL."],
  close: ["Confirm closing", "Confirmer la clôture", "បញ្ជាក់ការបញ្ចប់", "确认成交", "成約を確定", "Abschluss bestätigen", "Confirmar cierre"],
  closing: ["Closing marks the property sold or rented. Check all amounts before confirming.", "La clôture marque le bien vendu ou loué. Vérifiez les montants avant confirmation.", "ការបញ្ចប់កំណត់ថាលក់ឬជួលរួច។ សូមពិនិត្យចំនួនប្រាក់។", "成交后标记为已售或已租，请先核对金额。", "成約後は売却済み・賃貸済みになります。金額をご確認ください。", "Der Abschluss markiert das Objekt als verkauft/vermietet. Beträge vorher prüfen.", "El cierre marca vendido o alquilado. Comprueba los importes."],
  propertyDetails: ["Description, map and media", "Description, carte et médias", "ពិពណ៌នា ផែនទី និងឯកសារ", "描述、地图与媒体", "説明・地図・メディア", "Beschreibung, Karte und Medien", "Descripción, mapa y archivos"],
  description: ["Description", "Description", "ពិពណ៌នា", "描述", "説明", "Beschreibung", "Descripción"],
  latitude: ["Latitude", "Latitude", "រយៈទទឹង", "纬度", "緯度", "Breitengrad", "Latitud"],
  longitude: ["Longitude", "Longitude", "រយៈបណ្តោយ", "经度", "経度", "Längengrad", "Longitud"],
  coordinates: ["Provide both latitude and longitude.", "Renseignez la latitude et la longitude.", "សូមបំពេញកូអរដោនេទាំងពីរ។", "请同时填写经纬度。", "緯度と経度を両方入力してください。", "Breiten- und Längengrad angeben.", "Indica latitud y longitud."],
  fileHelp: ["JPEG/PNG/PDF, up to 2.5 MiB. Maximum 20 photos and 20 private documents per property. Files are not virus-scanned; download only trusted files.", "JPEG/PNG/PDF, 2,5 Mio maximum. Jusqu’à 20 photos et 20 documents privés par bien. Pas d’analyse antivirus ; téléchargez uniquement les fichiers de confiance.", "JPEG/PNG/PDF អតិបរមា 2.5 MiB។ 20 រូប និង 20 ឯកសារ។ គ្មានការស្កេនមេរោគ។", "JPEG/PNG/PDF，最大2.5 MiB。每套最多20张照片和20份私密文件，无病毒扫描。", "JPEG/PNG/PDF、最大2.5 MiB。写真20枚・非公開書類20件まで。ウイルス検査はありません。", "JPEG/PNG/PDF bis 2,5 MiB, je Objekt 20 Fotos und 20 private Dokumente. Kein Virenscan.", "JPEG/PNG/PDF hasta 2,5 MiB. Máximo 20 fotos y 20 documentos privados. Sin antivirus."],
  kind: ["Type", "Type", "ប្រភេទ", "类型", "種類", "Typ", "Tipo"],
  photo: ["Public photo", "Photo publique", "រូបសាធារណៈ", "公开照片", "公開写真", "Öffentliches Foto", "Foto pública"],
  document: ["Private document", "Document privé", "ឯកសារឯកជន", "私密文件", "非公開書類", "Privates Dokument", "Documento privado"],
  file: ["File", "Fichier", "ឯកសារ", "文件", "ファイル", "Datei", "Archivo"],
  upload: ["Upload", "Téléverser", "ផ្ទុកឯកសារ", "上传", "アップロード", "Hochladen", "Subir"],
  save: ["Save", "Enregistrer", "រក្សាទុក", "保存", "保存", "Speichern", "Guardar"],
  remove: ["Remove", "Supprimer", "លុប", "删除", "削除", "Löschen", "Eliminar"],
  confirmRemove: ["Confirm permanent removal", "Confirmer la suppression définitive", "បញ្ជាក់ការលុប", "确认永久删除", "完全削除を確認", "Endgültig löschen", "Confirmar eliminación definitiva"],
  cancel: ["Cancel", "Annuler", "បោះបង់", "取消", "キャンセル", "Abbrechen", "Cancelar"],
  failed: ["Request failed.", "La requête a échoué.", "សំណើបរាជ័យ។", "请求失败。", "処理に失敗しました。", "Anfrage fehlgeschlagen.", "La solicitud falló."],
  employment: ["Employment agreement · EN–KM", "Contrat de travail · anglais–khmer", "កិច្ចសន្យាការងារ · EN–KM", "劳动合同 · EN–KM", "雇用契約 · EN–KM", "Arbeitsvertrag · EN–KM", "Contrato laboral · EN–KM"],
  generateEmployment: ["Generate employment agreement", "Générer le contrat de travail", "បង្កើតកិច្ចសន្យាការងារ", "生成劳动合同", "雇用契約を作成", "Arbeitsvertrag erstellen", "Generar contrato laboral"],
  contractHelp: ["Enter both language versions. Check the terms before signing; generation does not sign the document.", "Renseignez les deux versions linguistiques. Vérifiez les clauses avant signature ; la génération ne signe pas le document.", "បំពេញភាសាទាំងពីរ។ ពិនិត្យលក្ខខណ្ឌមុនចុះហត្ថលេខា។ ការបង្កើតមិនចុះហត្ថលេខាទេ។", "请填写双语内容，签署前核对条款。生成文件不会添加签名。", "両言語で記入し、署名前に条項を確認してください。生成のみでは署名されません。", "Beide Sprachfassungen ausfüllen und vor Unterzeichnung prüfen. Die Erstellung unterschreibt das Dokument nicht.", "Completa ambos idiomas y revisa las cláusulas antes de firmar. Generar no firma el documento."],
  createContract: ["Create linked contract", "Créer le contrat lié", "បង្កើតកិច្ចសន្យាភ្ជាប់", "创建关联合同", "関連契約を作成", "Verknüpften Vertrag erstellen", "Crear contrato vinculado"],
  stepClient: ["Create an owner, buyer or tenant.", "Créer un propriétaire, acquéreur ou locataire.", "បង្កើតម្ចាស់ អ្នកទិញ ឬអ្នកជួល។", "创建业主、买方或租户。", "所有者・購入者・借主を登録します。", "Eigentümer, Käufer oder Mieter anlegen.", "Crear propietario, comprador o inquilino."],
  stepContract: ["Create a linked mandate or lease and download its bilingual contract.", "Créer un mandat ou bail lié et télécharger le contrat bilingue.", "បង្កើតអាណត្តិ ឬកិច្ចសន្យាជួល និងទាញយកជាពីរភាសា។", "创建关联委托或租约并下载双语合同。", "媒介契約・賃貸借契約を作成し、二言語版をダウンロードします。", "Mandat oder Mietvertrag verknüpfen und zweisprachig herunterladen.", "Crear mandato o arrendamiento vinculado y descargar el contrato bilingüe."],
  pdfReady: ["PDF downloaded.", "PDF téléchargé.", "បានទាញយក PDF។", "PDF 已下载。", "PDFをダウンロードしました。", "PDF heruntergeladen.", "PDF descargado."],
  hiringFileHelp: ["PDF, JPEG or PNG; maximum 2.5 MiB. One file per category. Replacement invalidates approval and the contract. No antivirus scan; use trusted files.", "PDF, JPEG ou PNG ; 2,5 Mio maximum. Un fichier par catégorie. Tout remplacement annule la validation et le contrat. Sans antivirus ; utilisez des fichiers de confiance.", "PDF JPEG ឬ PNG អតិបរមា 2.5 MiB។ មួយឯកសារក្នុងមួយប្រភេទ។ ការជំនួសលុបការអនុម័ត និងកិច្ចសន្យា។ គ្មានស្កេនមេរោគ។", "PDF、JPEG 或 PNG，最大2.5 MiB。每类一份，更换将取消审核和合同。无病毒扫描，请使用可信文件。", "PDF・JPEG・PNG、最大2.5 MiB。各区分1件。差替えで承認・契約が無効になります。ウイルス検査はなく、信頼できるファイルのみ使用してください。", "PDF, JPEG oder PNG bis 2,5 MiB, eine Datei je Kategorie. Ersatz hebt Freigabe und Vertrag auf. Kein Virenscan; nur vertrauenswürdige Dateien.", "PDF, JPEG o PNG, máximo2,5 MiB. Un archivo por categoría. Sustituir anula aprobación y contrato. Sin antivirus; usa archivos fiables."],
} as const satisfies Record<string, Row>;
export function agencyMessages(locale: Locale) {
  const index = locales.indexOf(locale);
  return Object.fromEntries(Object.entries(rows).map(([key, row]) => [key, row[index]])) as Record<keyof typeof rows, string>;
}
export function productionOverrides(locale: Locale) {
  const t = agencyMessages(locale);
  return {
    Preview: { collectionEyebrow: t.properties, collectionDescription: t.collection, demoLabel: t.published,
      results: t.results, viewProperty: t.properties, emptyDescription: t.empty, illustrationNote: t.illustration,
      detailNotice: t.collection, footerNotice: "KANTARA", aboutDescription: t.collection, heroFootnote: t.collection },
    Business: { title: t.properties, navigation: t.properties, identityReference: t.identity,
      agencyRegistration: t.registration, saved: t.saved, stepClient: t.stepClient, stepContract: t.stepContract,
      createContract: t.createContract, draftHelp: t.contractHelp, pdfReady: t.pdfReady, confirmClose: t.close, closingHelp: t.closing },
    Crm: { saved: t.saved },
  };
}
