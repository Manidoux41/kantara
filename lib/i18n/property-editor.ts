import { locales, type Locale } from "./routing";

type Row = readonly [string, string, string, string, string, string, string];
const rows = {
  furnishing: ["Furnishing", "Ameublement", "គ្រឿងសង្ហារឹម", "家具配置", "家具", "Möblierung", "Mobiliario"],
  FURNISHED: ["Furnished", "Meublé", "មានគ្រឿងសង្ហារឹម", "全配家具", "家具付き", "Möbliert", "Amueblado"],
  UNFURNISHED: ["Unfurnished", "Non meublé", "គ្មានគ្រឿងសង្ហារឹម", "无家具", "家具なし", "Unmöbliert", "Sin amueblar"],
  PARTIALLY_FURNISHED: ["Partially furnished", "Partiellement meublé", "មានគ្រឿងសង្ហារឹមខ្លះ", "部分家具", "一部家具付き", "Teilmöbliert", "Parcialmente amueblado"],
  unspecified: ["Not specified", "Non renseigné", "មិនបានបញ្ជាក់", "未注明", "未指定", "Nicht angegeben", "Sin especificar"],
  photos: ["Property photos", "Photos du bien", "រូបថតអចលនទ្រព្យ", "房源照片", "物件写真", "Immobilienfotos", "Fotos del inmueble"],
  addPhotos: ["Choose photos", "Choisir les photos", "ជ្រើសរើសរូបថត", "选择照片", "写真を選択", "Fotos auswählen", "Elegir fotos"],
  photoHelp: ["Up to 20 JPEG/PNG photos per property, 2.5 MiB each. Select a cover photo; the others appear in the gallery.", "Jusqu’à 20 photos JPEG/PNG par bien, 2,5 Mio chacune. Choisissez la photo principale ; les autres apparaissent dans la galerie.", "អតិបរមា 20 រូប JPEG/PNG ក្នុងមួយអចលនទ្រព្យ 2.5 MiB ក្នុងមួយរូប។ ជ្រើសរើសរូបចម្បង។", "每套最多20张 JPEG/PNG，每张2.5 MiB。选择封面，其余显示于图库。", "JPEG/PNG写真20枚まで、各2.5 MiB。メイン写真を選択してください。他はギャラリーに表示します。", "Bis zu 20 JPEG/PNG-Fotos pro Objekt, je 2,5 MiB. Titelbild wählen; weitere Fotos erscheinen in der Galerie.", "Hasta 20 fotos JPEG/PNG por inmueble, 2,5 MiB cada una. Elige la portada; las demás aparecen en la galería."],
  featured: ["Cover photo", "Photo principale", "រូបថតចម្បង", "封面照片", "メイン写真", "Titelbild", "Foto de portada"],
  setFeatured: ["Use as cover", "Mettre en avant", "កំណត់ជារូបចម្បង", "设为封面", "メインに設定", "Als Titelbild wählen", "Usar como portada"],
  remove: ["Remove", "Retirer", "លុប", "移除", "削除", "Entfernen", "Quitar"],
  uploadPhotos: ["Upload selected photos", "Téléverser les photos sélectionnées", "ផ្ទុករូបថតដែលបានជ្រើស", "上传所选照片", "選択写真をアップロード", "Ausgewählte Fotos hochladen", "Subir fotos seleccionadas"],
  photoLimit: ["Maximum 20 photos per property, including photos already uploaded.", "Maximum 20 photos par bien, en comptant les photos déjà téléversées.", "អតិបរមា 20 រូប រួមទាំងរូបដែលបានផ្ទុក។", "每套最多20张，包括已上传照片。", "アップロード済みを含め20枚までです。", "Höchstens 20 Fotos einschließlich bereits hochgeladener.", "Máximo20 fotos, incluidas las ya subidas."],
  invalidPhoto: ["Choose JPEG/PNG images no larger than 2.5 MiB each.", "Choisissez des images JPEG/PNG de 2,5 Mio maximum chacune.", "ជ្រើសរូប JPEG/PNG មិនលើស 2.5 MiB ក្នុងមួយរូប។", "请选择每张不超过2.5 MiB的 JPEG/PNG。", "各2.5 MiB以下のJPEG/PNGを選択してください。", "JPEG/PNG-Bilder mit jeweils höchstens 2,5 MiB wählen.", "Elige imágenes JPEG/PNG de hasta 2,5 MiB cada una."],
  uploadFailed: ["Some photos could not be uploaded. Successfully saved photos remain in the property; retry the remaining photos below.", "Certaines photos n’ont pas pu être téléversées. Les photos enregistrées sont conservées dans le bien ; réessayez les photos restantes ci-dessous.", "រូបខ្លះមិនអាចផ្ទុកបាន។ រូបដែលរក្សាទុកនៅតែមាន។ សូមព្យាយាមរូបនៅសល់។", "部分照片上传失败。已保存照片保留，可重试剩余照片。", "一部の写真をアップロードできませんでした。保存済み写真は保持されます。残りを再試行してください。", "Einige Fotos konnten nicht hochgeladen werden. Gespeicherte bleiben erhalten; übrige erneut versuchen.", "No se pudieron subir algunas fotos. Las guardadas se conservan; reintenta las restantes."],
  previous: ["Previous photo", "Photo précédente", "រូបមុន", "上一张", "前の写真", "Vorheriges Foto", "Foto anterior"],
  next: ["Next photo", "Photo suivante", "រូបបន្ទាប់", "下一张", "次の写真", "Nächstes Foto", "Foto siguiente"],
  photo: ["Photo", "Photo", "រូបថត", "照片", "写真", "Foto", "Foto"],
} as const satisfies Record<string, Row>;

export function propertyEditorMessages(locale: Locale) {
  return Object.fromEntries(Object.entries(rows).map(([key, row]) => [key, row[locales.indexOf(locale)]])) as Record<keyof typeof rows, string>;
}
