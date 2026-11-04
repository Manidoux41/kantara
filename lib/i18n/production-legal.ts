import { locales, type Locale } from "./routing";
type Row = readonly [string, string, string, string, string, string, string];
const rows = {
  publisherText: [
    "KANTARA provides real estate services in Cambodia. The publisher must provide its legal entity, registered address, registration, tax identifier and professional contact details. No licence or professional membership is asserted without supporting information.",
    "KANTARA propose des services immobiliers au Cambodge. L’éditeur doit renseigner sa raison sociale, son siège, son immatriculation, son identifiant fiscal et ses coordonnées professionnelles. Aucune licence ou affiliation n’est affirmée sans justificatif.",
    "KANTARA ផ្តល់សេវាអចលនទ្រព្យនៅកម្ពុជា។ អ្នកបោះពុម្ពត្រូវផ្តល់ព័ត៌មាននីតិបុគ្គល អាសយដ្ឋាន ចុះបញ្ជី លេខពន្ធ និងទំនាក់ទំនងវិជ្ជាជីវៈ។ មិនអះអាងអាជ្ញាបណ្ណដោយគ្មានភស្តុតាងទេ។",
    "KANTARA 提供柬埔寨房地产服务。发布者须提供法人、注册地址、登记号、税号及业务联系方式。未经证明不声称持有执照或专业会员资格。",
    "KANTARAはカンボジアの不動産サービスを提供します。運営者は法人・所在地・登録・税務番号・業務連絡先を明示する必要があります。根拠のない免許・所属の表明は行いません。",
    "KANTARA bietet Immobiliendienstleistungen in Kambodscha. Der Herausgeber muss Rechtsträger, Sitz, Registrierung, Steuernummer und Geschäftskontakt angeben. Lizenzen oder Mitgliedschaften werden ohne Nachweis nicht behauptet.",
    "KANTARA ofrece servicios inmobiliarios en Camboya. El editor debe indicar entidad legal, domicilio, registro, identificación fiscal y contacto profesional. No se afirman licencias ni afiliaciones sin respaldo.",
  ],
  data: ["Agency data", "Données de l’agence", "ទិន្នន័យភ្នាក់ងារ", "中介数据", "事業データ", "Agenturdaten", "Datos de la agencia"],
  teamPrivacy: ["Account security and retention", "Sécurité et conservation des comptes", "សុវត្ថិភាពគណនី", "账户安全与保留", "アカウントの安全と保存", "Kontosicherheit und Speicherung", "Seguridad y conservación de cuentas"],
  demo: ["Scope of services", "Périmètre des services", "វិសាលភាពសេវា", "服务范围", "サービスの範囲", "Leistungsumfang", "Alcance de los servicios"],
  feePolicyText: [
    "Fees must be agreed in writing: payer, amount or calculation, taxes, due event, cancellation/refund terms and receipts. No automatic statutory commission rate is asserted. Verify bank details independently before payment.",
    "Les honoraires sont à convenir par écrit : débiteur, montant ou calcul, taxes, exigibilité, annulation/remboursement et reçus. Aucun taux légal automatique de commission n’est affirmé. Vérifiez les coordonnées bancaires indépendamment avant paiement.",
    "កម្រៃត្រូវព្រមព្រៀងជាលាយលក្ខណ៍អក្សរ៖ អ្នកបង់ ចំនួន ឬវិធីគណនា ពន្ធ ពេលបង់ ការលុបចោល ការសង និងបង្កាន់ដៃ។ មិនអះអាងអត្រាកម្រៃច្បាប់ស្វ័យប្រវត្តិទេ។ ផ្ទៀងផ្ទាត់គណនីធនាគារមុនបង់។",
    "费用须书面约定付款人、金额或计算方式、税费、到期条件、取消退款及收据。不声称存在自动适用的法定佣金率。付款前请独立核实银行信息。",
    "支払者・金額または計算方法・税・支払条件・取消返金・領収書を書面で合意してください。自動的な法定手数料率は表明しません。送金前に銀行情報を別途確認してください。",
    "Honorare schriftlich vereinbaren: Zahlungspflichtiger, Betrag oder Berechnung, Steuern, Fälligkeit, Storno/Erstattung und Belege. Kein automatischer gesetzlicher Provisionssatz wird behauptet. Bankdaten vor Zahlung unabhängig prüfen.",
    "Pactar honorarios por escrito: pagador, importe o cálculo, impuestos, vencimiento, cancelación/reembolso y recibos. No se afirma una comisión legal automática. Verificar los datos bancarios independientemente antes de pagar.",
  ],
  documentsText: [
    "Bilingual contracts reproduce the information entered by the agency and provide signature fields. Generating a PDF does not sign it or certify its legal validity. Applicable clauses, language consistency and formalities must be checked before signature. No automatic translation or electronic signature is provided.",
    "Les contrats bilingues reprennent les informations saisies par l’agence et comportent des emplacements de signature. Générer un PDF ne le signe pas et ne certifie pas sa validité juridique. Clauses applicables, cohérence linguistique et formalités sont à vérifier avant signature. Aucune traduction automatique ni signature électronique n’est fournie.",
    "កិច្ចសន្យាពីរភាសាបង្ហាញព័ត៌មានដែលបានបញ្ចូល និងមានកន្លែងចុះហត្ថលេខា។ ការបង្កើត PDF មិនចុះហត្ថលេខា ឬបញ្ជាក់សុពលភាពច្បាប់ទេ។ ត្រូវពិនិត្យលក្ខខណ្ឌ ភាសា និងបែបបទមុនចុះហត្ថលេខា។ គ្មានបកប្រែស្វ័យប្រវត្តិ ឬហត្ថលេខាអេឡិចត្រូនិកទេ។",
    "双语合同使用中介录入的信息并提供签名栏。生成 PDF 不会签署文件或认证法律效力。签署前须核对条款、语言和手续。不提供自动翻译或电子签名。",
    "二言語契約は入力情報と署名欄を含みます。PDF生成のみでは署名や法的有効性の認証は行われません。署名前に条項・言語・手続を確認してください。自動翻訳・電子署名は提供しません。",
    "Zweisprachige Verträge enthalten Agenturangaben und Unterschriftsfelder. PDF-Erstellung unterzeichnet oder beglaubigt sie nicht. Klauseln, Sprachfassungen und Formalitäten vor Unterzeichnung prüfen. Keine automatische Übersetzung oder elektronische Signatur.",
    "Los contratos bilingües incluyen los datos introducidos y espacios de firma. Generar un PDF no firma ni certifica su validez jurídica. Revisar cláusulas, idiomas y formalidades antes de firmar. Sin traducción automática ni firma electrónica.",
  ],
  notice: [
    "Agency data is stored in PostgreSQL. Legal entity details, retention periods and policies must be completed and reviewed by a Cambodian professional before commercial use. This is not legal advice.",
    "Les données de l’agence sont conservées dans PostgreSQL. L’identité légale, les durées de conservation et les politiques restent à compléter et à valider par un professionnel cambodgien avant exploitation commerciale. Ceci ne constitue pas un conseil juridique.",
    "ទិន្នន័យភ្នាក់ងាររក្សាទុកក្នុង PostgreSQL។ ត្រូវបំពេញអត្តសញ្ញាណច្បាប់ រយៈពេលរក្សាទុក និងគោលការណ៍ ហើយឱ្យអ្នកជំនាញកម្ពុជាពិនិត្យមុនប្រើពាណិជ្ជកម្ម។ មិនមែនដំបូន្មានច្បាប់ទេ។",
    "中介数据存储于 PostgreSQL。商业使用前须补全法人信息、保留期限及政策，并由柬埔寨专业人士审核。不构成法律意见。",
    "事業データはPostgreSQLに保存します。商用利用前に法人情報・保存期間・方針を補完し、カンボジアの専門家に確認してください。法律上の助言ではありません。",
    "Agenturdaten liegen in PostgreSQL. Rechtsträger, Speicherfristen und Richtlinien müssen vor kommerzieller Nutzung ergänzt und in Kambodscha fachlich geprüft werden. Keine Rechtsberatung.",
    "Los datos se guardan en PostgreSQL. Antes del uso comercial deben completarse entidad legal, plazos y políticas con revisión profesional camboyana. No es asesoramiento jurídico.",
  ],
  dataText: [
    "The authenticated agency stores clients, CRM, appointments, contracts, revenue, hiring documents and inquiries in PostgreSQL. Private workspaces and file payloads are application-encrypted; only published listings and photos are public. Hiring documents are administrator-only. No antivirus scan is provided. Retention and deletion must be managed by the agency; signing out does not erase records.",
    "L’espace authentifié conserve clients, CRM, rendez-vous, contrats, revenus, dossiers d’embauche et demandes dans PostgreSQL. Les espaces privés et le contenu des fichiers sont chiffrés par l’application ; seules les annonces publiées et leurs photos sont publiques. Les pièces d’embauche sont réservées à l’administrateur. Aucun antivirus n’est fourni. L’agence doit gérer la conservation et la suppression ; la déconnexion n’efface pas les données.",
    "អតិថិជន CRM ណាត់ជួប កិច្ចសន្យា ចំណូល ឯកសារជ្រើសរើស និងសំណើរក្សាទុកក្នុង PostgreSQL។ កន្លែងឯកជន និងឯកសារត្រូវអ៊ិនគ្រីប។ មានតែបញ្ជី និងរូបផ្សព្វផ្សាយជាសាធារណៈ។ ឯកសារជ្រើសរើសសម្រាប់អ្នកគ្រប់គ្រង។ គ្មានស្កេនមេរោគ។ ការចាកចេញមិនលុបទិន្នន័យទេ។",
    "认证工作区在 PostgreSQL 保存客户、CRM、日程、合同、收入、招聘文件及询问。私密工作区和文件内容由应用加密；仅已发布房源及照片公开。招聘文件仅管理员可见。无病毒扫描。保留和删除由中介管理，退出不会删除记录。",
    "認証領域の顧客・CRM・予定・契約・収入・採用書類・問い合わせはPostgreSQLに保存します。非公開領域とファイルはアプリで暗号化し、公開物件と写真のみ一般公開します。採用書類は管理者専用です。ウイルス検査はなく、保存・削除は事業者が管理します。ログアウトでデータは消えません。",
    "Kunden, CRM, Termine, Verträge, Erlöse, Personalunterlagen und Anfragen liegen in PostgreSQL. Private Arbeitsbereiche und Dateiinhalte sind anwendungsseitig verschlüsselt; nur veröffentlichte Angebote und Fotos sind öffentlich. Personalunterlagen sind nur für Administratoren sichtbar. Kein Virenscan. Aufbewahrung und Löschung verwaltet die Agentur; Abmelden löscht keine Datensätze.",
    "Clientes, CRM, citas, contratos, ingresos, contratación y consultas se guardan en PostgreSQL. Espacios privados y archivos están cifrados; solo anuncios publicados y fotos son públicos. Documentos laborales solo para administradores. Sin antivirus. La agencia gestiona conservación y borrado; salir no elimina registros.",
  ],
  cookiesText: [
    "An HttpOnly, SameSite=Strict cookie authenticates API sessions for up to eight hours; it is Secure over HTTPS. Passwords use salted scrypt hashes and only session-token digests are retained. Logout, password changes and account disabling revoke sessions. No advertising or analytics tracker is configured by the application. Publish the controller, privacy contact, retention and transfer safeguards before launch.",
    "Un cookie HttpOnly, SameSite=Strict authentifie les sessions API pendant huit heures maximum ; il est Secure en HTTPS. Les mots de passe utilisent scrypt avec sel et seuls les condensats des jetons de session sont conservés. Déconnexion, changement de mot de passe et désactivation révoquent les sessions. Aucun traceur publicitaire ou analytique n’est configuré par l’application. Publiez le responsable, le contact confidentialité, la conservation et les garanties de transfert avant lancement.",
    "ខូគី HttpOnly និង SameSite=Strict ផ្ទៀងផ្ទាត់ API អតិបរមា៨ម៉ោង និង Secure លើ HTTPS។ ពាក្យសម្ងាត់ប្រើ scrypt ជាមួយ salt និងរក្សាតែ hash របស់ token។ ការចាកចេញ ប្តូរពាក្យសម្ងាត់ ឬបិទគណនីដកសម័យ។ គ្មានតាមដានពាណិជ្ជកម្ម។",
    "HttpOnly、SameSite=Strict Cookie 用于最多8小时的 API 会话，在 HTTPS 下标记 Secure。密码采用加盐 scrypt，仅保留令牌摘要。退出、改密和停用会撤销会话。应用无广告或分析追踪。上线前应公布控制者、隐私联系及保留和跨境保障。",
    "HttpOnly・SameSite=Strict CookieでAPIセッションを最大8時間認証し、HTTPSではSecureを付与します。パスワードはソルト付きscrypt、トークンはダイジェスト保存です。ログアウト・変更・無効化で失効します。広告・分析追跡は設定していません。責任者・連絡先・保存と移転方針を公開してください。",
    "Ein HttpOnly-/SameSite=Strict-Cookie authentifiziert API-Sitzungen bis zu acht Stunden, über HTTPS mit Secure. Passwörter nutzen gesalzene scrypt-Hashes; Sitzungstoken werden nur als Hash gespeichert. Abmelden, Passwortwechsel und Deaktivierung widerrufen Sitzungen. Keine Werbe-/Analyse-Tracker. Verantwortlichen, Datenschutzkontakt, Fristen und Transfergarantien veröffentlichen.",
    "Cookie HttpOnly/SameSite=Strict para sesiones API de hasta ocho horas, Secure en HTTPS. Contraseñas con scrypt y sal; tokens solo como hash. Salir, cambiar contraseña y desactivar revocan sesiones. Sin rastreadores publicitarios o analíticos. Publicar responsable, contacto, conservación y garantías de transferencia.",
  ],
  contactPrivacyText: [
    "OpenStreetMap loads only after map activation and receives IP/referrer. Cloudflare verifies anti-spam after activation. When email is enabled, Resend forwards your name, email, optional phone/date, message and property reference to the assigned agent or agency solely for a reply. Requests are also saved privately in PostgreSQL. Email acceptance is neither delivery confirmation nor a visit booking. Review provider terms, retention and transfers before real use.",
    "OpenStreetMap est chargé après activation et reçoit IP/référent. Cloudflare vérifie l’antispam après activation. Si l’e-mail est activé, Resend transmet nom, e-mail, téléphone/date facultatifs, message et référence à l’agent affecté ou à l’agence, uniquement pour répondre. Les demandes sont aussi conservées dans PostgreSQL en accès privé. L’acceptation d’un e-mail ne confirme ni réception ni visite. Validez les conditions des prestataires, la conservation et les transferts.",
    "OpenStreetMap ផ្ទុកក្រោយបើក ហើយទទួល IP និងប្រភពទំព័រ។ Cloudflare ផ្ទៀងផ្ទាត់ antispam។ ពេលបើកអ៊ីមែល Resend ផ្ញើព័ត៌មានសំណើទៅភ្នាក់ងារដើម្បីឆ្លើយ។ សំណើរក្សាទុកឯកជនក្នុង PostgreSQL។ ការទទួលអ៊ីមែលមិនធានាដល់ដៃ ឬកក់ទស្សនាទេ។",
    "启用地图后 OpenStreetMap 接收 IP 和来源页；启用验证后 Cloudflare 检查反垃圾。邮件启用时 Resend 将询问信息转发至分配的经纪人或中介，仅用于回复。请求也私密保存于 PostgreSQL。邮件被接受不代表送达或预约确认。需审核供应商条款、保留和跨境措施。",
    "地図有効化後OpenStreetMapにIPと参照元を送信し、認証有効化後Cloudflareが確認します。メール利用時Resend経由で問い合わせ情報を担当者へ回答目的で転送し、PostgreSQLにも非公開保存します。受付は配達・内覧確定ではありません。各社規約・保存・移転条件を確認してください。",
    "OpenStreetMap erhält IP/Referrer erst nach Kartenaktivierung. Cloudflare prüft Spam nach Aktivierung. Bei aktiviertem Versand leitet Resend Anfragedaten nur zur Antwort an Agent/Agentur weiter. Anfragen liegen zusätzlich privat in PostgreSQL. Annahme ist keine Zustellungs- oder Terminbestätigung. Anbieterbedingungen, Fristen und Transfers prüfen.",
    "OpenStreetMap recibe IP/referencia tras activar el mapa y Cloudflare verifica antispam tras activarlo. Con correo habilitado, Resend transmite los datos al agente/agencia solo para responder. Las consultas también se guardan privadamente en PostgreSQL. Aceptación no confirma entrega ni visita. Revisar proveedores, conservación y transferencias.",
  ],
} as const satisfies Record<string, Row>;
export function productionLegalMessages(locale: Locale) {
  const index = locales.indexOf(locale);
  const values = Object.fromEntries(Object.entries(rows).map(([key, row]) => [key, row[index]])) as Record<keyof typeof rows, string>;
  return { ...values, teamPrivacyText: values.cookiesText, demoText: values.notice, hostingText: values.notice };
}
