/**
 * nav-language.js - Bilingual English / Urdu (اردو) UI Engine & RTL Layout Support (agent2 - shahdara-mobile-nav)
 *
 * Implements Backlog Item 6:
 * - Persisted language preference key in localStorage ('shahdara_language_v1').
 * - Dynamic RTL / LTR layout switching (dir="rtl", lang="ur", .lang-ur class).
 * - Full translation dictionary for mobile navigation: Bottom Nav, More Drawer,
 *   Quick Collect sheet, Fast Customer Search, Collection Rounds, Quick Profile,
 *   and WhatsApp receipt / reminder share templates.
 * - Live DOM translation updates without page reload via [data-i18n],
 *   [data-i18n-placeholder], [data-i18n-title], and [data-i18n-aria-label], as well
 *   as standard navigation controls.
 * - Cross-tab language synchronization and custom event dispatch ('shahdara:language-change').
 */

export const LANGUAGE_STORAGE_KEY = 'shahdara_language_v1';
export const DEFAULT_LANGUAGE = 'en';
export const SUPPORTED_LANGUAGES = ['en', 'ur'];

/**
 * Authentic Pakistani Urdu & English localization dictionaries
 * tailored specifically for small ISP offline field collection & billing operations.
 */
export const TRANSLATIONS = {
  en: {
    // Language names & toggles
    lang_name: 'English',
    lang_switch_label: 'اردو',
    lang_switch_title: 'Switch to Urdu (اردو)',
    lang_aria_label: 'Switch interface language between English and Urdu',

    // App Branding & General
    app_title: 'Shahdara ISP',
    app_subtitle: 'Offline billing ledger',
    currency_pkr: 'PKR',
    currency_symbol: 'Rs.',
    save: 'Save',
    cancel: 'Cancel',
    close: 'Close',
    back: 'Back',
    all: 'All',
    search: 'Search',
    filter: 'Filter',
    export_csv: 'Export CSV',
    print: 'Print',
    copy: 'Copy',
    phone: 'Phone',
    area: 'Area',
    mohalla: 'Mohalla',
    date: 'Date',
    amount: 'Amount',
    status: 'Status',
    notes: 'Notes',
    actions: 'Actions',

    // Bottom Navigation Bar
    nav_home: 'Home',
    nav_customers: 'Customers',
    nav_collection: 'Collect',
    nav_bills: 'Bills',
    nav_reports: 'Reports',
    nav_more: 'More',
    nav_quick_actions: 'Actions',

    // Drawer Groups & Items
    drawer_group_ledger: 'Ledger & Collections',
    drawer_group_operations: 'Operations',
    drawer_group_assistant: 'Assistant & Tools',
    drawer_home: 'Home',
    drawer_customers: 'Customers',
    drawer_transactions: 'Transactions',
    drawer_bills: 'Monthly Bills',
    drawer_reports: 'Monthly Report',
    drawer_analytics: 'Area Analytics',
    drawer_inventory: 'Inventory & Materials',
    drawer_expenses: 'Expenses',
    drawer_field_tools: 'Field Tools…',
    drawer_assistant: 'Owner Assistant',
    drawer_alerts: 'Smart Alerts',
    drawer_recovery: 'Dues Recovery',
    drawer_quick_collect: 'Quick Collect Cash',
    drawer_search: 'Fast Customer Search',
    drawer_rounds: 'Field Collection Route',
    drawer_settings: 'App Settings',
    drawer_backup: 'Backup & Restore',
    drawer_collapse: 'Collapse to icon rail',
    drawer_close: 'Close navigation menu',

    // More Sheet Menu
    more_menu_title: 'More Features & Tools',
    more_language_toggle: '🌐 Language: اردو / English',
    more_menu_group_billing: 'Billing & Business',
    more_menu_group_field: 'Field Operations & Diagnostics',
    more_menu_group_reports: '📊 Billing & Business: Reports & Analytics',
    more_menu_group_money: '💰 Money & Operations',
    more_menu_group_customers: '👥 Customers & Data',
    more_menu_group_settings: '⚙️ Settings & Tools',
    more_backup: 'Backup & Restore',
    more_bills: 'Bills',

    // Status Badges
    status_paid: 'Paid',
    status_partial: 'Partial',
    status_pending: 'Pending Dues',
    status_active: 'Active',
    status_offline: 'Offline',
    status_unshared: 'Not Sent',
    status_shared: 'Sent via WA',

    // 2-Tap Quick Collect Sheet
    qc_title: '⚡ Quick Collect Cash',
    qc_subtitle: 'Fast 2-tap field collection and receipt generation',
    qc_pick_customer: 'Select Subscriber with Outstanding Dues',
    qc_search_placeholder: 'Search by name, #ID, phone, or area...',
    qc_collected_amount: 'Collected Amount (PKR)',
    qc_payment_method: 'Payment Method',
    qc_collection_date: 'Collection Date (PKT)',
    qc_collector_note: 'Collector Note / Payer Name (Optional)',
    qc_confirm_btn: 'Confirm & Save Receipt',
    qc_chip_full: 'Full Balance',
    qc_chip_half: '50%',
    qc_chip_1000: '1,000',
    qc_chip_1500: '1,500',
    qc_chip_2000: '2,000',
    qc_success_title: 'Payment Recorded Successfully!',
    qc_success_msg: 'Receipt created in offline ledger with zero cloud dependency.',
    qc_send_whatsapp: 'Send WhatsApp Receipt',
    qc_collect_another: 'Collect Another Payment',
    qc_invalid_amount: 'Please enter a valid positive payment amount.',

    // Fast Customer Search Sheet
    search_title: '🔍 Fast Customer Search',
    search_subtitle: 'Instant phone, name, and address search',
    search_placeholder: 'Search name, #ID, 03xx phone, area or mohalla...',
    search_chip_all: 'All Accounts',
    search_chip_dues: 'With Dues',
    search_chip_partial: 'Partial Paid',
    search_chip_settled: 'Fully Settled',
    search_recent_title: 'Recent Searches',
    search_clear_recent: 'Clear Recent',
    search_no_results: 'No subscribers found matching your query.',

    // Field Collection Route (Rounds)
    rounds_title: '📋 Field Collection Route',
    rounds_subtitle: 'Area-wise pending collections prioritized by urgency',
    rounds_select_area: 'Select Route Area',
    rounds_tab_all: 'All Stops',
    rounds_tab_pending: '⏳ Pending',
    rounds_tab_collected: '✅ Collected',
    rounds_target_label: 'Target:',
    rounds_collected_label: 'Collected:',
    rounds_remaining_label: 'Remaining:',
    rounds_empty_route: 'No subscribers with outstanding dues found for this area.',
    rounds_manifest_btn: 'Copy Route Manifest',
    rounds_print_btn: 'Print Route Slip',

    // Customer Quick Profile Sheet
    qp_title: 'Subscriber Quick Profile',
    qp_package: 'Internet Package',
    qp_current_bill: 'Current Bill',
    qp_total_outstanding: 'Total Outstanding Balance',
    qp_last_payment: 'Last Recorded Payment',
    qp_btn_collect: 'Collect Cash',
    qp_btn_whatsapp_reminder: 'WhatsApp Reminder',
    qp_btn_call: 'Call Phone',
    qp_btn_full_ledger: 'Open Full Ledger',

    // WhatsApp Messages
    wa_reminder_header: '*🚨 SHAHDARA BROADBAND - PAYMENT REMINDER NOTICE*',
    wa_receipt_header: '*🧾 SHAHDARA BROADBAND - OFFICIAL PAYMENT RECEIPT*',
    wa_subscriber_label: 'Subscriber',
    wa_package_label: 'Package',
    wa_received_amount: 'Amount Received',
    wa_remaining_balance: 'Remaining Balance',
    wa_payment_method: 'Payment Method',
    wa_thank_you: 'Thank you for choosing Shahdara Broadband.',

    // Toast Notifications
    toast_lang_changed_ur: 'زبان اردو میں تبدیل کر دی گئی ہے۔',
    toast_lang_changed_en: 'Language switched to English.',
    toast_copy_success: 'Copied to clipboard!',
    toast_receipt_shared: 'Receipt marked as shared on WhatsApp.',

    // Pending Actions Center
    drawer_pending_actions: 'Pending Actions',
    pending_actions_title: 'Pending Actions Center',
    pending_actions_subtitle: 'Unshared WhatsApp receipts, collection promises & offline queue',
    pending_tab_all: 'All Pending',
    pending_tab_receipts: '📱 WhatsApp Receipts',
    pending_tab_promises: '🤝 Promises Due',
    pending_tab_offline: '💾 Offline Queue',
    pending_no_actions: 'No pending actions! All receipts shared and follow-ups completed.',
    pending_share_all: 'Mark All Shared',
    pending_copy_digest: 'Copy Action List',
    pending_send_wa: 'Send WhatsApp',
    pending_mark_shared: 'Mark Shared',
    pending_collect: 'Collect Cash',
    pending_call: 'Call',
    pending_remind: 'Remind',
    pending_mark_done: 'Mark Done',
    pending_new_promise: '+ Schedule Promise',

    // Keyboard Shortcuts & Accessibility
    shortcuts_eyebrow: 'QUICK ACCESS & FIELD OPS',
    shortcuts_title: 'Keyboard Shortcuts',
    shortcuts_subtitle: 'Rapid navigation and field collection controls',
    shortcuts_group_field: 'Field Collection & Actions',
    shortcuts_quick_collect: 'Quick Collect Cash',
    shortcuts_fast_search: 'Fast Customer Search',
    shortcuts_pending_actions: 'Pending Actions Center',
    shortcuts_collection_route: 'Collection Route Sheet',
    shortcuts_top_defaulters: 'Dues Recovery & Delinquency',
    shortcuts_mom_growth: 'MoM Growth & Momentum',
    shortcuts_group_nav: 'Global Navigation',
    shortcuts_nav_customers: 'Customers Roster',
    shortcuts_nav_transactions: 'Transactions History',
    shortcuts_nav_reports: 'Monthly Reports',
    shortcuts_nav_analytics: 'Area Analytics',
    shortcuts_nav_inventory: 'Inventory Stock',
    shortcuts_nav_expenses: 'Expense Manager',
    shortcuts_group_system: 'System & Accessibility',
    shortcuts_lang_toggle: 'Toggle Language (English / اردو)',
    shortcuts_theme_toggle: 'Toggle Dark / Light Theme',
    shortcuts_drawer_toggle: 'Toggle Navigation Drawer',
    shortcuts_help: 'Open Shortcuts Help',
    shortcuts_dismiss: 'Close Active Modal / Drawer',
    shortcuts_tip: 'Tip: Press shortcuts anywhere except when typing in input or search fields.',

    // PWA & Mobile Performance
    pwa_install_btn: 'Install App',
    pwa_install_banner_title: 'Install Shahdara ISP Billing',
    pwa_install_banner_desc: 'Fast 2-tap field collections, works 100% offline, home screen launch.',
    pwa_install_action: 'Install App',
    pwa_install_dismiss: 'Not Now',
    pwa_status_title: 'PWA & Offline System Health',
    pwa_status_installed: 'Installed (Standalone App)',
    pwa_status_browser: 'Running in Browser Tab',
    pwa_status_offline_ready: '100% Offline Ready (Cache v37)',
    pwa_shortcuts_heading: 'App Shortcuts (Home Screen)',
    pwa_shortcut_collect: 'Quick Collect Cash (2-Taps)',
    pwa_shortcut_add_cust: 'Register New Customer',
    pwa_shortcut_dues: "Today's Overdue & Dues",
    pwa_update_check: 'Check for Updates',
    pwa_update_success: 'App cache is up to date!'
  },

  ur: {
    // Language names & toggles
    lang_name: 'اردو',
    lang_switch_label: 'English',
    lang_switch_title: 'انگریزی میں تبدیل کریں (Switch to English)',
    lang_aria_label: 'انٹرفیس کی زبان اردو اور انگریزی کے درمیان تبدیل کریں',

    // App Branding & General
    app_title: 'شاہدرہ براڈبینڈ',
    app_subtitle: 'آف لائن بلنگ و کھاتہ جات',
    currency_pkr: 'روپے',
    currency_symbol: 'روپے',
    save: 'محفوظ کریں',
    cancel: 'منسوخ کریں',
    close: 'بند کریں',
    back: 'پیچھے جائیں',
    all: 'تمام',
    search: 'تلاش کریں',
    filter: 'فلٹر',
    export_csv: 'ایکسپورٹ CSV',
    print: 'پرنٹ کریں',
    copy: 'کاپی کریں',
    phone: 'فون نمبر',
    area: 'علاقہ',
    mohalla: 'محلہ / گلی',
    date: 'تاریخ',
    amount: 'رقم',
    status: 'حیثیت (سٹیٹس)',
    notes: 'نوٹ / تفصیل',
    actions: 'اقدامات',

    // Bottom Navigation Bar
    nav_home: 'ڈیش بورڈ',
    nav_customers: 'صارفین',
    nav_collection: 'وصولی',
    nav_bills: 'بلز',
    nav_reports: 'رپورٹس',
    nav_more: 'مزید',
    nav_quick_actions: 'فوری کام',

    // Drawer Groups & Items
    drawer_group_ledger: 'کھاتہ جات اور وصولیاں',
    drawer_group_operations: 'آپریشنز اور سامان',
    drawer_group_assistant: 'معاون اور ٹولز',
    drawer_home: 'ہوم',
    drawer_customers: 'کسٹمرز کی فہرست',
    drawer_transactions: 'ادائیگیوں کا ریکارڈ',
    drawer_bills: 'ماہانہ بل',
    drawer_reports: 'ماہانہ کلوزنگ رپورٹ',
    drawer_analytics: 'علاقائی تجزیہ (Area)',
    drawer_inventory: 'اسٹاک اور سامان (تار، راؤٹر)',
    drawer_expenses: 'روزمرہ کے اخراجات',
    drawer_field_tools: 'فیلڈ ٹولز…',
    drawer_assistant: 'مالک کا ڈیجیٹل اسسٹنٹ',
    drawer_alerts: 'اہم الرٹس و الرٹ سسٹم',
    drawer_recovery: 'بقایا جات کی ریکوری',
    drawer_quick_collect: 'فوری نقد وصولی',
    drawer_search: 'فوری صارف تلاش',
    drawer_rounds: 'فیلڈ وصولی کا روٹ',
    drawer_settings: 'ایپ سیٹنگز',
    drawer_backup: 'بیک اپ اور بحالی',
    drawer_collapse: 'سائیڈ بار بند کریں',
    drawer_close: 'مینو بند کریں',

    // More Sheet Menu
    more_menu_title: 'مزید فیچرز اور کاروباری ٹولز',
    more_language_toggle: '🌐 زبان: English / اردو',
    more_menu_group_billing: 'بلنگ اور کاروباری امور',
    more_menu_group_field: 'فیلڈ آپریشنز اور تشخیصی ٹولز',
    more_menu_group_reports: '📊 بلنگ و کاروباری رپورٹس اور تجزیات',
    more_menu_group_money: '💰 رقوم اور کیش آپریشنز',
    more_menu_group_customers: '👥 صارفین اور ڈیٹا کھاتہ',
    more_menu_group_settings: '⚙️ ترتیبات اور فیلڈ ٹولز',
    more_backup: 'بیک اپ اور بحالی',
    more_bills: 'بلز اور کھاتہ جات',

    // Status Badges
    status_paid: 'مکمل ادا شدہ',
    status_partial: 'جزوی ادا شدہ',
    status_pending: 'واجب الادا بقایا',
    status_active: 'فعال (ایکٹو)',
    status_offline: 'آف لائن (بند)',
    status_unshared: 'واٹس ایپ نہیں بھیجی',
    status_shared: 'واٹس ایپ بھیج دی گئی',

    // 2-Tap Quick Collect Sheet
    qc_title: '⚡ فوری نقد وصولی (2-Tap)',
    qc_subtitle: 'فیلڈ میں موقع پر وصولی اور رسید بنانے کا تیز ترین طریقہ',
    qc_pick_customer: 'بقایا دار صارف منتخب کریں',
    qc_search_placeholder: 'نام، نمبر #ID، فون یا علاقہ تلاش کریں...',
    qc_collected_amount: 'وصول شدہ رقم (روپے)',
    qc_payment_method: 'ادائیگی کا ذریعہ',
    qc_collection_date: 'وصولی کی تاریخ (PKT)',
    qc_collector_note: 'کلکٹر نوٹ / ادا کنندہ کا نام (اختیاری)',
    qc_confirm_btn: 'ادائیگی محفوظ اور رسید جاری کریں',
    qc_chip_full: 'مکمل بقایا',
    qc_chip_half: '50% آدھا',
    qc_chip_1000: '1,000',
    qc_chip_1500: '1,500',
    qc_chip_2000: '2,000',
    qc_success_title: 'ادائیگی کامیابی سے درج ہو گئی!',
    qc_success_msg: 'رسید آف لائن محفوظ ہو گئی، کلاؤڈ یا انٹرنیٹ کی ضرورت نہیں۔',
    qc_send_whatsapp: 'واٹس ایپ پر رسید بھیجیں',
    qc_collect_another: 'اگلی وصولی درج کریں',
    qc_invalid_amount: 'براہ کرم درست نقد رقم درج کریں۔',

    // Fast Customer Search Sheet
    search_title: '🔍 فوری صارف تلاش',
    search_subtitle: 'فون، نام اور پتے سے سیکنڈوں میں تلاش',
    search_placeholder: 'صارف کا نام، نمبر #ID، فون 03xx، محلہ لکھیں...',
    search_chip_all: 'تمام کھاتے',
    search_chip_dues: 'بقایا جات والے',
    search_chip_partial: 'جزوی ادائیگی',
    search_chip_settled: 'مکمل بے باق',
    search_recent_title: 'حالیہ تلاش شدہ کسٹمرز',
    search_clear_recent: 'ہسٹری صاف کریں',
    search_no_results: 'دی گئی معلومات کے مطابق کوئی صارف نہیں ملا۔',

    // Field Collection Route (Rounds)
    rounds_title: '📋 فیلڈ وصولی روٹ لسٹ',
    rounds_subtitle: 'علاقہ وار بقایا دار صارفین کی فہرست بلحاظ ترجیح',
    rounds_select_area: 'علاقہ / روٹ منتخب کریں',
    rounds_tab_all: 'تمام صارفین',
    rounds_tab_pending: '⏳ باقی صارفین',
    rounds_tab_collected: '✅ وصول شدہ',
    rounds_target_label: 'کل وصولی ہدف:',
    rounds_collected_label: 'وصول شدہ:',
    rounds_remaining_label: 'باقی رقم:',
    rounds_empty_route: 'اس علاقے میں کوئی بقایا دار صارف نہیں ملا۔',
    rounds_manifest_btn: 'روٹ لسٹ کاپی کریں',
    rounds_print_btn: 'پرنٹ روٹ سلپ',

    // Customer Quick Profile Sheet
    qp_title: 'صارف کا فوری پروفائل',
    qp_package: 'انٹرنیٹ پیکیج',
    qp_current_bill: 'موجودہ مہینے کا بل',
    qp_total_outstanding: 'کل واجب الادا رقم',
    qp_last_payment: 'آخری ادائیگی کا ریکارڈ',
    qp_btn_collect: 'رقم وصول کریں',
    qp_btn_whatsapp_reminder: 'بل یاد دہانی نوٹس',
    qp_btn_call: 'براہ راست کال',
    qp_btn_full_ledger: 'مکمل کھاتہ کھولیں',

    // WhatsApp Messages
    wa_reminder_header: '*🚨 شاہدرہ براڈبینڈ - بل ادائیگی کا حتمی نوٹس*',
    wa_receipt_header: '*🧾 شاہدرہ براڈبینڈ - باضابطہ نقد وصولی رسید*',
    wa_subscriber_label: 'صارف کا نام',
    wa_package_label: 'پیکیج سپیڈ',
    wa_received_amount: 'وصول شدہ رقم',
    wa_remaining_balance: 'باقی واجب الادا',
    wa_payment_method: 'ادائیگی کا طریقہ',
    wa_thank_you: 'شاہدرہ براڈبینڈ منتخب کرنے کا شکریہ۔',

    // Toast Notifications
    toast_lang_changed_ur: 'زبان اردو میں تبدیل کر دی گئی ہے۔',
    toast_lang_changed_en: 'Language switched to English.',
    toast_copy_success: 'کلپ بورڈ پر کاپی ہو گیا!',
    toast_receipt_shared: 'رسید واٹس ایپ پر شیئر مارک ہو گئی۔',

    // Pending Actions Center (اردو)
    drawer_pending_actions: 'زیر التواء کام',
    pending_actions_title: 'ایکشن سینٹر - زیر التواء کام',
    pending_actions_subtitle: 'غیر ارسال شدہ واٹس ایپ رسیدیں، وعدے اور آف لائن کیو',
    pending_tab_all: 'تمام زیر التواء',
    pending_tab_receipts: '📱 واٹس ایپ رسیدیں',
    pending_tab_promises: '🤝 ادائیگی کے وعدے',
    pending_tab_offline: '💾 آف لائن کیو',
    pending_no_actions: 'کوئی زیر التواء کام نہیں! تمام رسیدیں بھیج دی گئیں اور کام مکمل ہیں۔',
    pending_share_all: 'سب شیئرڈ مارک کریں',
    pending_copy_digest: 'فہرست کاپی کریں',
    pending_send_wa: 'واٹس ایپ بھیجیں',
    pending_mark_shared: 'شیئرڈ مارک کریں',
    pending_collect: 'رقم وصول کریں',
    pending_call: 'کال کریں',
    pending_remind: 'یاد دہانی',
    pending_mark_done: 'مکمل ہو گیا',
    pending_new_promise: '+ نیا وعدہ درج کریں',

    // Keyboard Shortcuts & Accessibility
    shortcuts_eyebrow: 'فوری رسائی اور فیلڈ آپریشنز',
    shortcuts_title: 'کی بورڈ شارٹ کٹس',
    shortcuts_subtitle: 'تیز رفتار نیویگیشن اور نقد ریکوری کے کنٹرولز',
    shortcuts_group_field: 'فیلڈ کلیکشن اور فوری کام',
    shortcuts_quick_collect: 'فوری نقد وصولی',
    shortcuts_fast_search: 'فوری گاہک تلاش',
    shortcuts_pending_actions: 'پینڈنگ ایکشنز سینٹر',
    shortcuts_collection_route: 'کلیکشن روٹ شیٹ',
    shortcuts_top_defaulters: 'بقایا جات اور ریکوری لسٹ',
    shortcuts_mom_growth: 'ماہانہ گروتھ اور مومینٹم',
    shortcuts_group_nav: 'اہم پیجز اور نیویگیشن',
    shortcuts_nav_customers: 'صارفین کی فہرست',
    shortcuts_nav_transactions: 'ادائیگیوں کا کھاتہ',
    shortcuts_nav_reports: 'ماہانہ کلوزنگ رپورٹس',
    shortcuts_nav_analytics: 'علاقائی تجزیہ (Area)',
    shortcuts_nav_inventory: 'اسٹاک اور سامان',
    shortcuts_nav_expenses: 'اخراجات کا انتظام',
    shortcuts_group_system: 'سسٹم اور معاونت (Accessibility)',
    shortcuts_lang_toggle: 'زبان تبدیل کریں (اردو / English)',
    shortcuts_theme_toggle: 'ڈارک / لائٹ تھیم تبدیل کریں',
    shortcuts_drawer_toggle: 'نیویگیشن مینو کھولیں',
    shortcuts_help: 'شارٹ کٹس کی مدد',
    shortcuts_dismiss: 'فعال ونڈو / ڈائیلاگ بند کریں',
    shortcuts_tip: 'ٹپ: کسی بھی وقت شارٹ کٹ بٹن دبائیں (سوائے ٹائپنگ کے دوران)۔',

    // PWA & Mobile Performance
    pwa_install_btn: 'ایپ انسٹال کریں',
    pwa_install_banner_title: 'شاہدرہ بلنگ ایپ انسٹال کریں',
    pwa_install_banner_desc: 'آف لائن 2 ٹیپ کیش وصولی اور ہوم اسکرین شارٹ کٹس کے ساتھ تیز رفتار استعمال۔',
    pwa_install_action: 'انسٹال کریں',
    pwa_install_dismiss: 'ابھی نہیں',
    pwa_status_title: 'آف لائن سسٹم اور پی ڈبلیو اے معلومات',
    pwa_status_installed: 'انسٹال شدہ (اسٹینڈ الون ایپ)',
    pwa_status_browser: 'براؤزر ٹیب میں جاری',
    pwa_status_offline_ready: '100% آف لائن تیار (کیشے محفوظ)',
    pwa_shortcuts_heading: 'ہوم اسکرین شارٹ کٹس',
    pwa_shortcut_collect: 'فوری کیش وصولی (2 ٹیپ)',
    pwa_shortcut_add_cust: 'نیا گاہک درج کریں',
    pwa_shortcut_dues: 'آج کے واجب الادا بقایا جات',
    pwa_update_check: 'ایپ اپ ڈیٹ چیک کریں',
    pwa_update_success: 'ایپ کیشے بالکل اپ ٹو ڈیٹ ہے!'
  }
};

/**
 * Reads the active application language from storage.
 * @param {Storage|Object} [storage=localStorage]
 * @returns {'en'|'ur'}
 */
export function getAppLanguage(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return DEFAULT_LANGUAGE;
  try {
    const val = storage.getItem(LANGUAGE_STORAGE_KEY);
    return SUPPORTED_LANGUAGES.includes(val) ? val : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

/**
 * Translates a key into the target language with optional variable interpolation.
 * @param {string} key - Translation dictionary key
 * @param {'en'|'ur'} [lang] - Language code (defaults to currently active)
 * @param {Object} [params] - Optional interpolation variables {param: value}
 * @returns {string} Translated text
 */
export function t(key, lang = null, params = {}) {
  const currentLang = lang && SUPPORTED_LANGUAGES.includes(lang) ? lang : getAppLanguage();
  const dict = TRANSLATIONS[currentLang] || TRANSLATIONS.en;
  let text = dict[key] ?? TRANSLATIONS.en[key] ?? key;

  if (params && typeof params === 'object') {
    Object.entries(params).forEach(([paramKey, val]) => {
      text = text.replaceAll(`{${paramKey}}`, String(val ?? ''));
    });
  }
  return text;
}

/**
 * Applies text direction, HTML lang attribute, and CSS class to document root.
 * @param {'en'|'ur'} lang - Language code
 * @param {HTMLElement} [rootElement=document.documentElement]
 */
export function applyLanguageDirection(lang, rootElement = (typeof document !== 'undefined' ? document.documentElement : null)) {
  if (!rootElement) return;

  const isUrdu = lang === 'ur';
  rootElement.setAttribute('lang', isUrdu ? 'ur' : 'en');
  rootElement.setAttribute('dir', isUrdu ? 'rtl' : 'ltr');
  if (isUrdu) ensureUrduFont();

  if (isUrdu) {
    rootElement.classList.add('lang-ur');
  } else {
    rootElement.classList.remove('lang-ur');
  }

  // Also sync body class if body is available
  if (typeof document !== 'undefined' && document.body) {
    if (isUrdu) {
      document.body.classList.add('lang-ur');
    } else {
      document.body.classList.remove('lang-ur');
    }
  }
}

/**
 * Scans container for elements decorated with i18n data-attributes and standard navigation controls.
 * - [data-i18n="key"]: Updates textContent.
 * - [data-i18n-placeholder="key"]: Updates placeholder attribute.
 * - [data-i18n-title="key"]: Updates title attribute.
 * - [data-i18n-aria-label="key"]: Updates aria-label attribute.
 * - Updates bottom nav, drawer, modals, and toggle buttons.
 * @param {'en'|'ur'} [lang]
 * @param {HTMLElement|Document} [container=document]
 */
/* ==========================================================================
   Issue #228: visible-text Urdu coverage, bidi safety and the Urdu font.
   The t() dictionary above only covers elements that were wired with
   data-i18n or a dedicated selector. The app also renders hundreds of
   buttons/headings from templates in app.js and the dashboard/nav modules;
   the map + patterns below translate those visible strings in place (and
   restore the English originals, kept in data-i18n-original, when the user
   switches back). A MutationObserver in setupLanguageToggle re-applies the
   pass to nodes rendered after the toggle.
   ========================================================================== */

export const URDU_SCRIPT_PATTERN = /[\u0600-\u06FF]/;

export function isEnglishOnlyVisibleText(text) {
  const value = String(text ?? '').replace(/\s+/g, ' ').trim();
  return /[A-Za-z]{2,}/.test(value) && !URDU_SCRIPT_PATTERN.test(value);
}

// Texts that may stay Latin in Urdu mode: the language toggle names the
// language it switches TO, and the brand name is a proper noun.
export function isAllowlistedVisibleText(text) {
  const value = String(text ?? '').replace(/\s+/g, ' ').trim();
  return /^(?:🌐\s*)?(?:English|اردو)$/.test(value) || /^Shahdara(?: ISP)?$/.test(value);
}

export const VISIBLE_TEXT_UR = {
  '+ Add payment': '+ ادائیگی شامل کریں',
  '+ Add Payment': '+ ادائیگی شامل کریں',
  '+ Add Customer': '+ گاہک شامل کریں',
  'Aaj ka hisaab': 'آج کا حساب',
  'All': 'تمام',
  'Active': 'فعال',
  'Bulk add': 'یکمشت شامل کریں',
  'Package not set': 'پیکیج منتخب نہیں',
  'All (incl. Not set)': 'تمام (بشمول منتخب نہیں)',
  'Area Collections': 'علاقے کی وصولیاں',
  'Area Intelligence': 'علاقہ جائزہ',
  'Ask': 'پوچھیں',
  'Avg LTV': 'اوسط LTV',
  'Back': 'واپس',
  'Backup Ledger': 'بیک اپ لیجر',
  'Base': 'بنیادی',
  'Bear': 'مندی',
  'Billed': 'بل شدہ',
  'Billing Audit': 'بلنگ آڈٹ',
  'Billing dashboard': 'بلنگ ڈیش بورڈ',
  'Bull': 'تیزی',
  'Cash Register': 'کیش رجسٹر',
  'Channel ROI': 'چینل ROI',
  'Clear': 'صاف کریں',
  'Cohort Drilldown': 'گروہ تفصیل',
  'Collections': 'وصولیاں',
  'Current Month Bill Settlement': 'رواں مہینے کے بل کی تصفیہ',
  'Customer add': 'گاہک شامل کریں',
  'Data Integrity': 'ڈیٹا درستگی',
  'Download all payment details (.txt)': 'تمام ادائیگیوں کی تفصیل ڈاؤن لوڈ کریں (.txt)',
  'Dues Aging (0–90+d)': 'واجبات کی عمر (0–90+ دن)',
  'Dues list': 'واجبات کی فہرست',
  'Executive Briefing': 'ایگزیکٹو بریفنگ',
  'Field Enrollment': 'فیلڈ اندراج',
  'Geographic Collection Heatmap': 'جغرافیائی وصولی نقشہ',
  'Good': 'اچھا',
  'Home': 'ہوم',
  '← Home': 'ہوم →',
  'Incident Matrix': 'واقعات میٹرکس',
  'Lagging': 'پیچھے',
  'Late Fee & Discounts': 'تاخیر فیس اور رعایت',
  'MoM Growth': 'ماہانہ ترقی',
  'Moderate': 'درمیانہ',
  'Month': 'مہینہ',
  'Monthly Collection vs Target': 'ماہانہ وصولی بمقابلہ ہدف',
  'Monthly Report': 'ماہانہ رپورٹ',
  'Next →': 'اگلا ←',
  '← Previous': 'پچھلا →',
  'Not set': 'منتخب نہیں',
  'Offline': 'آف لائن',
  'Optical Port Matrix': 'آپٹیکل پورٹ میٹرکس',
  'Optimal': 'بہترین',
  'Outstanding Dues by Area': 'علاقے کے حساب سے واجبات',
  'Overdue': 'زائد المیعاد',
  'Owner Command Center': 'مالک کمانڈ سینٹر',
  'P&L Statement': 'نفع و نقصان بیان',
  'Package Revenue': 'پیکیج آمدنی',
  'Paid': 'ادا شدہ',
  'Partial': 'جزوی',
  'Payment lo': 'ادائیگی لیں',
  'Pending': 'زیر التوا',
  'Performance & Collection Analytics': 'کارکردگی و وصولی تجزیہ',
  'Record Expense': 'خرچ درج کریں',
  'Recovery Pipeline': 'وصولی کا سلسلہ',
  'Revenue & Collections Trend': 'آمدنی و وصولی کا رجحان',
  'Route Density Matrix': 'روٹ کثافت میٹرکس',
  'Scenario Modeler': 'منظرنامہ ماڈل',
  'Set / Manage Target': 'ہدف مقرر / منظم کریں',
  'Shaping Forecast': 'شیپنگ پیشگوئی',
  'Show backup and restore controls': 'بیک اپ اور بحالی کنٹرول دکھائیں',
  'Simulate Margins': 'مارجن جانچیں',
  'Top Defaulters': 'بڑے نادہندگان',
  'Total Revenue': 'کل آمدنی',
  'Upstream Routes': 'اپ اسٹریم روٹس',
  'View All': 'تمام دیکھیں',
  'View At-Risk': 'خطرے والے دیکھیں',
  'Voice · on-device only': 'آواز · صرف اسی ڈیوائس پر',
  'Watch': 'توجہ دیں',
  '📊 Cash Closing Suite': '📊 کیش کلوزنگ سوٹ',
  '📋 Daily Slip': '📋 روزانہ پرچی',
  '📋 Table': '📋 جدول',
  '📖 Daily Register': '📖 روزانہ رجسٹر',
  '📥 Export CSV': '📥 CSV برآمد کریں',
  '📱 Wizard': '📱 وزرڈ',
  '📲 Share Backup': '📲 بیک اپ شیئر کریں',
  '🗂️ Cards': '🗂️ کارڈز',
  '🛡️ Protect Storage': '🛡️ اسٹوریج محفوظ کریں',
  '⇪ Bulk add': '⇪ یکمشت شامل کریں',
  '☰ Show details': '☰ تفصیل دکھائیں',
  'Add Customer': 'گاہک شامل کریں',
  'Add Payment': 'ادائیگی شامل کریں',
  'Add payment': 'ادائیگی شامل کریں',
  'Export CSV': 'CSV برآمد کریں',
  'Print Slips': 'پرچیاں چھاپیں',
  'Remind Pending': 'زیر التوا کو یاد دہانی',
  '💬 Remind Pending': '💬 زیر التوا کو یاد دہانی',
  'Explain this change': 'یہ تبدیلی سمجھائیں',
  'Open ledger': 'لیجر کھولیں',
  'Filters & sort': 'منتخب و ترتیب',
  '⚙ Filters & sort ↓': '⚙ منتخب و ترتیب ↓',
  'Bulk Collect Cash': 'یکمشت نقد وصولی',
  'many payments in one batch': 'کئی ادائیگیاں ایک بیچ میں',
  '💵 Bulk Collect Cash many payments in one batch': '💵 یکمشت نقد وصولی — کئی ادائیگیاں ایک بیچ میں',
  'High Dues ≥ 2k': 'زیادہ واجبات ≥ 2k',
  'Set packages & monthly fee': 'پیکیج اور ماہانہ فیس مقرر کریں',
  "Generate this month's bills": 'اس مہینے کے بل بنائیں',
  'Sab customers dikhayein · Show all': 'تمام گاہک دکھائیں',
  '📋 Switch to Full Ledger & Transactions Table': '📋 مکمل لیجر و لین دین جدول پر جائیں',
  'Send to my WhatsApp': 'میرے WhatsApp پر بھیجیں'
};

export const VISIBLE_TEXT_PATTERNS_UR = [
  [/^(.+?) Diagnostics$/, m => `${m[1]} تشخیص`],
  [/^(.+?) Fleet Audit$/, m => `${m[1]} فلیٹ آڈٹ`],
  [/^Active (\d+)$/, m => `فعال ${m[1]}`],
  [/^Offline (\d+)$/, m => `آف لائن ${m[1]}`],
  [/^Not set (\d+)$/, m => `منتخب نہیں ${m[1]}`],
  [/^Archived customers (\d+)$/, m => `محفوظ گاہک ${m[1]}`],
  [/^Customers (\d+)$/, m => `گاہک ${m[1]}`],
  [/^(.*) Package not set$/, m => `${m[1]} پیکیج منتخب نہیں`],
  [/^Show all (\d+) rankings$/, m => `تمام ${m[1]} درجے دکھائیں`],
  // "Pending (0)", "All (74)": translate the label, keep the count.
  [/^(.+?) \((\d+)\)$/, m => {
    const base = Object.prototype.hasOwnProperty.call(VISIBLE_TEXT_UR, m[1]) ? VISIBLE_TEXT_UR[m[1]] : null;
    return base ? `${base} (${m[2]})` : null;
  }]
];

export const PLACEHOLDER_TEXT_UR = {
  'Search this list': 'اس فہرست میں تلاش کریں',
  'Name, ID, status, amount or method': 'نام، شناخت، حیثیت، رقم یا طریقہ',
  'Name, phone, customer # or ID': 'نام، فون، گاہک نمبر یا شناخت',
  'Search registry...': 'رجسٹری تلاش کریں...',
  'Technician Name': 'ٹیکنیشن کا نام',
  'Tech Name': 'ٹیکنیشن کا نام',
  'Notes...': 'نوٹس...',
  'Location': 'مقام',
  'Search area, mohalla, or zone...': 'علاقہ، محلہ یا زون تلاش کریں...',
  'Search item name or notes...': 'شے کا نام یا نوٹس تلاش کریں...',
  'Search notes…': 'نوٹس تلاش کریں…',
  'Search Txn ID, customer, phone, or amount...': 'ٹرانزیکشن شناخت، گاہک، فون یا رقم تلاش کریں...',
  'Type a command or search customers...': 'کمانڈ لکھیں یا گاہک تلاش کریں...',
  'Paste standard Easypaisa notification email or SMS text here...': 'ایزی پیسہ اطلاع کی ای میل یا SMS یہاں چسپاں کریں...',
  'Filter technician / area...': 'ٹیکنیشن / علاقہ منتخب کریں...',
  'Filter by ID, location, tech...': 'شناخت، مقام، ٹیکنیشن سے منتخب کریں...',
  "Search customer in this month's report by name, # or area...": 'اس مہینے کی رپورٹ میں نام، نمبر یا علاقے سے گاہک تلاش کریں...'
};

export function translateVisibleText(text) {
  const value = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (Object.prototype.hasOwnProperty.call(VISIBLE_TEXT_UR, value)) return VISIBLE_TEXT_UR[value];
  for (const [pattern, render] of VISIBLE_TEXT_PATTERNS_UR) {
    const match = value.match(pattern);
    if (match) {
      const rendered = render(match);
      if (rendered) return rendered;
    }
  }
  return null;
}

// Wrap phone numbers, PKR amounts and digit runs in <bdi> so they keep their
// order inside RTL Urdu text (the punctuation/number jumping of #228).
const BIDI_TOKEN_PATTERN = /(\+92\d{10}|03\d{2}[- ]?\d{7}|PKR\s*[\d,]+|Rs\.?\s*[\d,]+|\d[\d,]*)/g;
export function setBidiSafeText(el, text) {
  try {
    const doc = el.ownerDocument || (typeof document !== 'undefined' ? document : null);
    if (!doc || typeof doc.createElement !== 'function' || typeof doc.createTextNode !== 'function') {
      el.textContent = text;
      return;
    }
    el.textContent = '';
    for (const part of String(text).split(BIDI_TOKEN_PATTERN)) {
      if (!part) continue;
      if (new RegExp(`^(?:${BIDI_TOKEN_PATTERN.source})$`).test(part)) {
        const bdi = doc.createElement('bdi');
        bdi.textContent = part;
        el.appendChild(bdi);
      } else {
        el.appendChild(doc.createTextNode(part));
      }
    }
  } catch {
    try { el.textContent = text; } catch { /* mock element */ }
  }
}

const LANGUAGE_TOGGLE_IDS = new Set(['languageToggleBtn', 'drawerLanguageToggleBtn', 'mobileMoreLanguageToggleBtn']);
function isLanguageToggle(el) {
  try {
    return LANGUAGE_TOGGLE_IDS.has(el.id) || Boolean(el.closest?.('.language-toggle-btn, [data-action="toggle-language"]'));
  } catch { return false; }
}

function leafElements(el) {
  const leaves = [];
  try {
    if (!el.children || el.children.length === 0) return [el];
    el.querySelectorAll('*').forEach(node => {
      if (!node.children || node.children.length === 0) leaves.push(node);
    });
  } catch { /* mock element */ }
  return leaves;
}

function translateLeaf(leaf, lang) {
  try {
    if (!leaf || !leaf.dataset) return 0;
    if (lang === 'en') {
      if (leaf.dataset.i18nOriginal !== undefined) {
        leaf.textContent = leaf.dataset.i18nOriginal;
        delete leaf.dataset.i18nOriginal;
        return 1;
      }
      return 0;
    }
    const original = String(leaf.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (!original || isAllowlistedVisibleText(original)) return 0;
    if (!isEnglishOnlyVisibleText(original)) return 0; // already Urdu (ours or the app's)
    // The app may have rewritten this node with a NEW English label since we
    // last translated it (e.g. #srPrimaryAction changes per screen): the
    // stored original is stale then, so fall through and translate the new
    // label, overwriting the stored original below.
    const translated = translateVisibleText(original);
    if (!translated || translated === original) {
      if (leaf.dataset.i18nOriginal !== undefined && leaf.dataset.i18nOriginal !== original) delete leaf.dataset.i18nOriginal;
      return 0;
    }
    leaf.dataset.i18nOriginal = original;
    setBidiSafeText(leaf, translated);
    return 1;
  } catch { return 0; }
}

// Buttons that mix an icon element with a bare text node (e.g. "⇪ Bulk add")
// have no leaf element for the text; translate that text node in place.
// Counter chips ("Pending (<span>0</span>)") are handled by translating the
// label prefix of the first text node and leaving the count span untouched.
function translateDirectText(el, lang) {
  try {
    if (!el || !el.dataset || !el.childNodes) return 0;
    const textNodes = [...el.childNodes].filter(n => n.nodeType === 3 && String(n.nodeValue ?? '').trim());
    if (lang === 'en') {
      if (el.dataset.i18nOriginalNodes !== undefined) {
        const originals = JSON.parse(el.dataset.i18nOriginalNodes);
        textNodes.forEach((node, i) => { if (originals[i] !== undefined) node.nodeValue = originals[i]; });
        delete el.dataset.i18nOriginalNodes;
        delete el.dataset.i18nOriginalDirect;
        return 1;
      }
      return 0;
    }
    if (el.dataset.i18nOriginalNodes !== undefined) {
      // If the app rewrote this element with a new English label, the stored
      // nodes are stale: clear them and translate the new label instead.
      const current = String(el.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (!isEnglishOnlyVisibleText(current)) return 0;
      delete el.dataset.i18nOriginalNodes;
      delete el.dataset.i18nOriginalDirect;
    }
    if (!textNodes.length) return 0;
    const store = () => {
      el.dataset.i18nOriginalNodes = JSON.stringify(textNodes.map(n => n.nodeValue));
    };
    if (textNodes.length === 1) {
      const original = textNodes[0].nodeValue.replace(/\s+/g, ' ').trim();
      if (!original || !isEnglishOnlyVisibleText(original) || isAllowlistedVisibleText(original)) return 0;
      const translated = translateVisibleText(original);
      if (!translated || translated === original) return 0;
      store();
      el.dataset.i18nOriginalDirect = original;
      textNodes[0].nodeValue = textNodes[0].nodeValue.replace(original, translated);
      return 1;
    }
    // Multiple text nodes: translate the label prefix of the first one
    // ("Pending (" -> "زیر التوا (", "All (" -> "تمام (").
    const first = textNodes[0];
    const core = first.nodeValue.trim().replace(/\(\s*$/, '').trim();
    if (!core || !isEnglishOnlyVisibleText(core) || isAllowlistedVisibleText(core)) return 0;
    const translated = translateVisibleText(core);
    if (!translated || translated === core) return 0;
    store();
    first.nodeValue = first.nodeValue.replace(core, translated);
    return 1;
  } catch { return 0; }
}

// Translate (or, for 'en', restore) every visible button / summary / heading
// whose text is in the visible-text dictionary. Returns the number changed.
export function translateVisibleElements(lang, container = (typeof document !== 'undefined' ? document : null)) {
  if (!container || typeof container.querySelectorAll !== 'function') return 0;
  let changed = 0;
  try {
    container.querySelectorAll('button, summary, h1, h2, h3, h4').forEach(el => {
      if (isLanguageToggle(el)) return;
      for (const leaf of leafElements(el)) changed += translateLeaf(leaf, lang);
      changed += translateDirectText(el, lang);
      if (lang === 'en') changed += translateLeaf(el, lang);
    });
  } catch { /* partial mock containers in unit tests */ }
  try {
    container.querySelectorAll('[placeholder]').forEach(el => {
      if (!el.dataset) return;
      if (lang === 'ur') {
        const ph = el.getAttribute('placeholder');
        const ur = ph && PLACEHOLDER_TEXT_UR[ph];
        if (ur) {
          if (el.dataset.i18nOriginalPlaceholder === undefined) el.dataset.i18nOriginalPlaceholder = ph;
          el.setAttribute('placeholder', ur);
        }
      } else if (el.dataset.i18nOriginalPlaceholder !== undefined) {
        el.setAttribute('placeholder', el.dataset.i18nOriginalPlaceholder);
        delete el.dataset.i18nOriginalPlaceholder;
      }
    });
    if (lang === 'ur') {
      // Mixed-direction values (names, phones, amounts) read best LTR-isolated.
      container.querySelectorAll('input, textarea, select').forEach(el => {
        if (!el.getAttribute('dir')) el.setAttribute('dir', 'auto');
      });
    }
  } catch { /* partial mock containers in unit tests */ }
  return changed;
}

// Self-hosted Noto Nastaliq Urdu (urdu-font.css, subset) is loaded only when
// Urdu mode is active, so English first load pays nothing for it (#228).
export function ensureUrduFont(doc = (typeof document !== 'undefined' ? document : null)) {
  try {
    if (!doc || !doc.head || typeof doc.createElement !== 'function') return false;
    if (doc.getElementById && doc.getElementById('urduFontLink')) return true;
    const link = doc.createElement('link');
    link.id = 'urduFontLink';
    link.rel = 'stylesheet';
    link.href = './urdu-font.css';
    doc.head.appendChild(link);
    return true;
  } catch { return false; }
}

export function updateDocumentTranslations(lang = null, container = (typeof document !== 'undefined' ? document : null)) {
  if (!container || typeof container.querySelectorAll !== 'function') return;

  const activeLang = lang && SUPPORTED_LANGUAGES.includes(lang) ? lang : getAppLanguage();

  // 1. data-i18n: Update text content
  const textElements = container.querySelectorAll('[data-i18n]');
  textElements.forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (!key) return;

    // Check if element contains child badges or icons that must be preserved
    if (el.hasAttribute('data-i18n-preserve-children')) {
      const childBadges = Array.from(el.querySelectorAll('.bottom-nav-badge, .nav-drawer-badge, .badge, svg'));
      el.textContent = t(key, activeLang) + ' ';
      childBadges.forEach(b => el.appendChild(b));
    } else {
      el.textContent = t(key, activeLang);
    }
  });

  // 2. data-i18n-placeholder
  const placeholderElements = container.querySelectorAll('[data-i18n-placeholder]');
  placeholderElements.forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key) el.setAttribute('placeholder', t(key, activeLang));
  });

  // 3. data-i18n-title
  const titleElements = container.querySelectorAll('[data-i18n-title]');
  titleElements.forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    if (key) el.setAttribute('title', t(key, activeLang));
  });

  // 4. data-i18n-aria-label
  const ariaElements = container.querySelectorAll('[data-i18n-aria-label]');
  ariaElements.forEach(el => {
    const key = el.getAttribute('data-i18n-aria-label');
    if (key) el.setAttribute('aria-label', t(key, activeLang));
  });

  // 5. Update bottom navigation buttons
  const bottomNavMap = {
    home: 'nav_home',
    customers: 'nav_customers',
    collection: 'nav_collection',
    bills: 'nav_bills',
    reports: 'nav_reports',
    more: 'nav_more'
  };
  Object.entries(bottomNavMap).forEach(([target, key]) => {
    const btn = container.querySelector(`[data-mobile-nav="${target}"]`);
    if (btn) {
      const badge = btn.querySelector('.bottom-nav-badge');
      btn.textContent = t(key, activeLang);
      if (badge) btn.appendChild(badge);
    }
  });

  const actionToggleSpan = container.querySelector('#mobileActionSheetToggle span:not(.mobile-action-plus)');
  if (actionToggleSpan) {
    actionToggleSpan.textContent = t('nav_quick_actions', activeLang);
  }

  // 6. Update Drawer group titles
  const drawerGroups = container.querySelectorAll('.nav-drawer-group-title');
  if (drawerGroups.length >= 3) {
    drawerGroups[0].textContent = t('drawer_group_ledger', activeLang);
    drawerGroups[1].textContent = t('drawer_group_operations', activeLang);
    drawerGroups[2].textContent = t('drawer_group_assistant', activeLang);
  }

  // 7. Update Drawer navigation items
  const drawerNavMap = {
    home: 'drawer_home',
    customers: 'drawer_customers',
    transactions: 'drawer_transactions',
    bills: 'drawer_bills',
    reports: 'drawer_reports',
    analytics: 'drawer_analytics',
    inventory: 'drawer_inventory',
    expenses: 'drawer_expenses',
    assistant: 'drawer_assistant',
    alerts: 'drawer_alerts',
    recovery: 'drawer_recovery',
    backup: 'drawer_backup',
    'field-tools': 'drawer_field_tools'
  };
  Object.entries(drawerNavMap).forEach(([target, key]) => {
    const btn = container.querySelector(`[data-nav-target="${target}"]`);
    if (btn) {
      const span = btn.querySelector('span:not(.nav-drawer-icon):not(.nav-drawer-badge)');
      if (span) span.textContent = t(key, activeLang);
    }
  });

  const routeBtn = container.querySelector('[data-open-field-route] span:not(.nav-drawer-icon):not(.nav-drawer-badge)');
  if (routeBtn) routeBtn.textContent = t('drawer_rounds', activeLang);

  // 7b. Update More Sheet Menu
  const moreMenu = container.querySelector('#mobileMoreMenu');
  if (moreMenu) {
    const titleEl = moreMenu.querySelector('.more-menu-title');
    if (titleEl) titleEl.textContent = t('more_menu_title', activeLang);
    const sectionLabels = moreMenu.querySelectorAll('.more-menu-section-label');
    sectionLabels.forEach((label, idx) => {
      const key = label.getAttribute('data-i18n');
      if (key && typeof t(key, activeLang) === 'string') {
        label.textContent = t(key, activeLang);
      } else if (idx === 0) {
        label.textContent = t('more_menu_group_billing', activeLang);
      } else if (idx === 1) {
        label.textContent = t('more_menu_group_field', activeLang);
      }
    });
  }

  // 8. Update Quick Collect Modal
  const qcTitle = container.querySelector('#quickCollectTitle');
  if (qcTitle) qcTitle.textContent = t('qc_title', activeLang);

  const qcSearch = container.querySelector('#quickCollectSearchInput');
  if (qcSearch) qcSearch.setAttribute('placeholder', t('qc_search_placeholder', activeLang));

  const qcConfirm = container.querySelector('#quickCollectConfirmBtn');
  if (qcConfirm) qcConfirm.textContent = t('qc_confirm_btn', activeLang);

  const qcWa = container.querySelector('#quickCollectWhatsAppBtn');
  if (qcWa) qcWa.textContent = t('qc_send_whatsapp', activeLang);

  const qcAnother = container.querySelector('#quickCollectAnotherBtn');
  if (qcAnother) qcAnother.textContent = t('qc_collect_another', activeLang);

  // 9. Update Fast Customer Search Modal
  const fcsTitle = container.querySelector('#fastCustomerSearchTitle');
  if (fcsTitle) fcsTitle.textContent = t('search_title', activeLang);

  const fcsSearch = container.querySelector('#fastCustomerSearchInput');
  if (fcsSearch) fcsSearch.setAttribute('placeholder', t('search_placeholder', activeLang));

  // 10. Update Customer Quick Profile Modal
  const qpTitle = container.querySelector('#mobileQuickProfileTitle');
  if (qpTitle) qpTitle.textContent = t('qp_title', activeLang);

  // 11. Update Field Route / Collection Rounds Modal
  const frTitle = container.querySelector('#fieldRouteModalTitle');
  if (frTitle) frTitle.textContent = t('rounds_title', activeLang);

  // 12. Update toggle button labels
  const toggleLabels = container.querySelectorAll('.language-toggle-label, #languageToggleLabel');
  toggleLabels.forEach(el => {
    el.textContent = activeLang === 'ur' ? 'English' : 'اردو';
  });

  const toggleBtns = container.querySelectorAll('.language-toggle-btn, #languageToggleBtn, #drawerLanguageToggleBtn, #mobileMoreLanguageToggleBtn');
  toggleBtns.forEach(btn => {
    btn.setAttribute('title', t('lang_switch_title', activeLang));
    btn.setAttribute('aria-label', t('lang_aria_label', activeLang));
  });

  // 13. Issue #228: translate every remaining visible button/heading from
  // the visible-text dictionary (and restore English originals on switch back).
  try { translateVisibleElements(activeLang, container); } catch { /* mock containers */ }
}

/**
 * Persists language preference to storage and triggers UI translation and direction change.
 * @param {'en'|'ur'} lang - Target language
 * @param {Storage|Object} [storage=localStorage]
 * @param {HTMLElement} [rootElement=document.documentElement]
 * @returns {'en'|'ur'} Active language set
 */
export function setAppLanguage(
  lang,
  storage = (typeof localStorage !== 'undefined' ? localStorage : null),
  rootElement = (typeof document !== 'undefined' ? document.documentElement : null)
) {
  const targetLang = SUPPORTED_LANGUAGES.includes(lang) ? lang : DEFAULT_LANGUAGE;

  if (storage) {
    try {
      storage.setItem(LANGUAGE_STORAGE_KEY, targetLang);
    } catch {
      // Ignore storage write errors (quota / disabled storage)
    }
  }

  applyLanguageDirection(targetLang, rootElement);
  updateDocumentTranslations(targetLang, typeof document !== 'undefined' ? document : null);

  // Dispatch custom event for external subscribers
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    try {
      window.dispatchEvent(new CustomEvent('shahdara:language-change', {
        detail: { language: targetLang, isRtl: targetLang === 'ur' }
      }));
    } catch {
      // Fallback for older event environments
    }
  }

  return targetLang;
}

/**
 * Toggles language between 'en' and 'ur'.
 * @param {Storage|Object} [storage=localStorage]
 * @param {HTMLElement} [rootElement=document.documentElement]
 * @returns {'en'|'ur'} New language set
 */
export function toggleAppLanguage(
  storage = (typeof localStorage !== 'undefined' ? localStorage : null),
  rootElement = (typeof document !== 'undefined' ? document.documentElement : null)
) {
  const current = getAppLanguage(storage);
  const nextLang = current === 'ur' ? 'en' : 'ur';
  return setAppLanguage(nextLang, storage, rootElement);
}

/**
 * Formats a currency amount with bilingual PKR symbol.
 * @param {number|string} amount
 * @param {'en'|'ur'} [lang]
 * @returns {string}
 */
export function formatBilingualCurrency(amount, lang = null) {
  const num = Number(amount) || 0;
  const currentLang = lang && SUPPORTED_LANGUAGES.includes(lang) ? lang : getAppLanguage();
  const formatted = num.toLocaleString('en-US');
  return currentLang === 'ur' ? `روپے ${formatted}` : `PKR ${formatted}`;
}

/**
 * Maps standard billing status to bilingual display label.
 * @param {string} status - 'paid' | 'partial' | 'pending' | 'active' | 'offline'
 * @param {'en'|'ur'} [lang]
 * @returns {string}
 */
export function formatBilingualStatus(status, lang = null) {
  const currentLang = lang && SUPPORTED_LANGUAGES.includes(lang) ? lang : getAppLanguage();
  const normalized = String(status ?? '').toLowerCase().trim();
  switch (normalized) {
    case 'paid':
    case 'settled':
      return t('status_paid', currentLang);
    case 'partial':
      return t('status_partial', currentLang);
    case 'pending':
    case 'due':
      return t('status_pending', currentLang);
    case 'active':
      return t('status_active', currentLang);
    case 'offline':
      return t('status_offline', currentLang);
    default:
      return status || '';
  }
}

/**
 * Generates pure HTML string for language toggle button.
 * @param {'en'|'ur'} [lang]
 * @param {string} [id='languageToggleBtn']
 * @param {string} [extraClass='']
 * @returns {string}
 */
export function renderLanguageToggleBtnHtml(lang = null, id = 'languageToggleBtn', extraClass = '') {
  const active = lang && SUPPORTED_LANGUAGES.includes(lang) ? lang : getAppLanguage();
  const nextLabel = active === 'ur' ? 'English' : 'اردو';
  const title = t('lang_switch_title', active);
  const aria = t('lang_aria_label', active);

  return `
    <button id="${id}" class="language-toggle-btn ${extraClass}".trim() type="button" aria-label="${aria}" title="${title}">
      <span class="lang-icon" aria-hidden="true">🌐</span>
      <span class="language-toggle-label">${nextLabel}</span>
    </button>
  `.trim();
}

/**
 * Sets up language controller, binds click events to toggle buttons,
 * and initializes DOM direction and translations.
 * @param {Object} [options]
 * @param {Storage|Object} [options.storage]
 * @param {Function} [options.onToast]
 * @returns {Object} Controller interface
 */
export function setupLanguageToggle({
  storage = (typeof localStorage !== 'undefined' ? localStorage : null),
  onToast = null
} = {}) {
  if (typeof document === 'undefined') {
    return {
      getLanguage: () => getAppLanguage(storage),
      setLanguage: (l) => setAppLanguage(l, storage, null),
      toggleLanguage: () => toggleAppLanguage(storage, null),
      t,
      updateDocumentTranslations: () => {}
    };
  }

  // 1. Initial boot: read saved language and apply direction & translations
  const initialLang = getAppLanguage(storage);
  applyLanguageDirection(initialLang, document.documentElement);
  updateDocumentTranslations(initialLang, document);

  // 1b. Issue #228: content rendered after the toggle (customer lists,
  // dashboard cards, dialogs) arrives in English from the templates; while
  // Urdu is active, translate new nodes as they appear.
  if (typeof MutationObserver !== 'undefined' && document.body) {
    let pending = null;
    const observer = new MutationObserver(() => {
      if (getAppLanguage(storage) !== 'ur' || pending) return;
      pending = setTimeout(() => {
        pending = null;
        try { translateVisibleElements('ur', document); } catch { /* ignore */ }
      }, 60);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function handleToggleClick() {
    const newLang = toggleAppLanguage(storage, document.documentElement);
    const toastMsg = newLang === 'ur' ? t('toast_lang_changed_ur', 'ur') : t('toast_lang_changed_en', 'en');
    if (typeof onToast === 'function') {
      onToast(toastMsg);
    }
  }

  // 2. Attach listeners to all known language toggle triggers
  const btnIds = ['languageToggleBtn', 'drawerLanguageToggleBtn', 'mobileMoreLanguageToggleBtn'];
  btnIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', handleToggleClick);
  });

  // 3. Delegate click listener in case buttons are dynamically rendered or in modals
  document.addEventListener('click', e => {
    const btn = e?.target?.closest?.('.language-toggle-btn, [data-action="toggle-language"]');
    if (btn && !btnIds.includes(btn.id)) {
      handleToggleClick();
    }
  });

  // 4. Multi-tab synchronization
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('storage', e => {
      if (e.key === LANGUAGE_STORAGE_KEY && e.newValue) {
        const syncedLang = SUPPORTED_LANGUAGES.includes(e.newValue) ? e.newValue : DEFAULT_LANGUAGE;
        applyLanguageDirection(syncedLang, document.documentElement);
        updateDocumentTranslations(syncedLang, document);
      }
    });
  }

  return {
    getLanguage: () => getAppLanguage(storage),
    setLanguage: (lang) => setAppLanguage(lang, storage, document.documentElement),
    toggleLanguage: handleToggleClick,
    t,
    formatCurrency: (amt) => formatBilingualCurrency(amt, getAppLanguage(storage)),
    formatStatus: (st) => formatBilingualStatus(st, getAppLanguage(storage)),
    updateTranslations: (container = document) => updateDocumentTranslations(getAppLanguage(storage), container)
  };
}
