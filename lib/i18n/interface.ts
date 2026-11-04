import { locales, type Locale } from "./routing";

const rows = {
  favorites: ["My favorites", "Mes favoris", "បញ្ជីចូលចិត្ត", "我的收藏", "お気に入り", "Meine Favoriten", "Mis favoritos"],
  addFavorite: ["Add to favorites", "Ajouter aux favoris", "បន្ថែមទៅបញ្ជីចូលចិត្ត", "加入收藏", "お気に入りに追加", "Zu Favoriten hinzufügen", "Añadir a favoritos"],
  removeFavorite: ["Remove from favorites", "Retirer des favoris", "ដកចេញពីបញ្ជីចូលចិត្ត", "取消收藏", "お気に入りから削除", "Aus Favoriten entfernen", "Quitar de favoritos"],
  favoriteHelp: ["Favorites stay on this page until you reload or change language.", "Les favoris restent sur cette page jusqu’au rechargement ou au changement de langue.", "បញ្ជីចូលចិត្តរក្សាទុកលើទំព័រនេះរហូតដល់ផ្ទុកឡើងវិញ ឬប្តូរភាសា។", "收藏仅保留在当前页面，刷新或切换语言后清除。", "お気に入りは再読み込みや言語変更でリセットされます。", "Favoriten bleiben bis zum Neuladen oder Sprachwechsel auf dieser Seite.", "Los favoritos se mantienen hasta recargar o cambiar de idioma."],
  favoritesEmpty: ["No favorites match your search", "Aucun favori ne correspond à la recherche", "មិនមានបញ្ជីចូលចិត្តត្រូវនឹងការស្វែងរក", "没有符合搜索条件的收藏", "条件に合うお気に入りはありません", "Keine Favoriten passen zur Suche", "Ningún favorito coincide con la búsqueda"],
  favoritesHint: ["Use the heart on a property to save it here, or adjust your filters.", "Utilisez le cœur d’un bien pour le retrouver ici, ou ajustez les filtres.", "ប្រើបេះដូងលើអចលនទ្រព្យដើម្បីបន្ថែម ឬកែតម្រូវតម្រង។", "点击房产上的爱心加入收藏，或调整筛选条件。", "物件のハートで追加するか、検索条件を変更してください。", "Mit dem Herz am Objekt vormerken oder die Filter anpassen.", "Usa el corazón de un inmueble para guardarlo o ajusta los filtros."],
  grid: ["Grid view", "Vue grille", "ទិដ្ឋភាពក្រឡា", "网格视图", "グリッド表示", "Rasteransicht", "Vista de cuadrícula"],
  list: ["List view", "Vue liste", "ទិដ្ឋភាពបញ្ជី", "列表视图", "リスト表示", "Listenansicht", "Vista de lista"],
  display: ["Display options", "Options d’affichage", "ជម្រើសបង្ហាញ", "显示选项", "表示設定", "Anzeigeoptionen", "Opciones de visualización"],
  quickAccess: ["Quick access", "Accès rapide", "ចូលប្រើរហ័ស", "快捷入口", "クイックアクセス", "Schnellzugriff", "Acceso rápido"],
  localWorkspace: ["The connected CRM is available locally in development only. On this deployed preview, explore the fictional modules below.", "Le CRM connecté est réservé au développement local. Sur cet aperçu déployé, explorez les modules fictifs ci-dessous.", "CRM ភ្ជាប់ប្រើបានតែក្នុងការអភិវឌ្ឍក្នុងម៉ាស៊ីន។ សូមមើលម៉ូឌុលសាកល្បងខាងក្រោម។", "关联 CRM 仅限本地开发。此部署预览可浏览下方虚构模块。", "連携CRMはローカル開発専用です。この公開プレビューでは下の架空モジュールをご覧ください。", "Das verbundene CRM ist nur lokal in der Entwicklung verfügbar. Erkunden Sie hier die fiktiven Vorschau-Module.", "El CRM conectado solo está disponible en desarrollo local. Explora los módulos ficticios de esta vista previa."],
} satisfies Record<string, readonly string[]>;

export function interfaceMessages(locale: Locale) {
  const index = locales.indexOf(locale);
  return Object.fromEntries(Object.entries(rows).map(([key, values]) => [key, values[index]]));
}
