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

    // Customers page — Urdu auto-translation phase 1 (roster + new-customers panel)
    cust_new_customers_eyebrow: 'NEW CUSTOMERS',
    cust_new_customers_by_month: 'New customers by month',
    cust_newcust_this_month: 'This month',
    cust_newcust_last_month: 'Last month',
    cust_newcust_last_3_months: 'Last 3 months',
    cust_newcust_last_6_months: 'Last 6 months',
    cust_newcust_month_label: 'Month',
    cust_newcust_choose_month: 'Choose a month…',
    cust_newcust_count: '{count} new customers',
    cust_newcust_connection_fees: 'Connection fees',
    cust_newcust_routers: 'routers',
    cust_newcust_fiber: 'Fiber',
    cust_newcust_fiber_meters: '{meters} m',
    cust_newcust_empty: 'No new customers in this view.',
    cust_newcust_note: 'Join counts include customers archived later.',
    cust_newcust_undated: '{count} customers have no join date (added before dates were recorded) and are not counted in any month.',
    cust_newcust_area_not_set: 'Area not set',
    cust_newcust_joined: 'joined {month}',
    cust_newcust_fee: 'Fee {amount}',
    cust_newcust_router: 'Router {model}',
    cust_newcust_fiber_m: '{meters} m fiber',
    cust_newcust_install_surplus: 'Install: net surplus {amount}',
    cust_newcust_install_subsidy: 'Install: ISP subsidy {amount}',
    cust_newcust_install_breakeven_suffix: ' · break-even {months} bills',
    cust_newcust_install_breakeven: 'Install: break-even',
    cust_newcust_install_unknown: 'Install cost {cost} · fee not recorded',
    cust_newcust_onboarding_none: 'Onboarding details not recorded',
    cust_newcust_quick_views_aria: 'New-customer quick views',
    cust_month_jan: 'January',
    cust_month_feb: 'February',
    cust_month_mar: 'March',
    cust_month_apr: 'April',
    cust_month_may: 'May',
    cust_month_jun: 'June',
    cust_month_jul: 'July',
    cust_month_aug: 'August',
    cust_month_sep: 'September',
    cust_month_oct: 'October',
    cust_month_nov: 'November',
    cust_month_dec: 'December',
    cust_all_areas: 'All areas',
    cust_page_info: 'Page {page} of {totalPages} ({total} total)',
    cust_no_matching: 'No matching customers.',
    cust_no_match_filters: 'No customers match these service and billing filters.',
    cust_card_actually_received: 'Actually received',
    cust_card_time_with_isp: 'Time with ISP',
    cust_card_no_receipts: 'No receipts',
    cust_card_no_payment_entries: 'No payment entries',
    cust_card_recorded_receipts: '{count} recorded receipts',
    cust_card_package_not_set: 'Package not set',
    cust_card_open_hint: 'Open full profile and monthly billing history',
    cust_card_health: 'Health',
    cust_card_health_reasons: 'Health reasons',
    cust_card_health_none: 'Not enough completed priced months for an automatic score.',
    cust_health_cat_insufficient: 'insufficient history',
    cust_health_cat_insufficient_metrics: 'Insufficient recorded metrics',
    cust_health_cat_strong: 'Strong recorded indicators',
    cust_health_cat_mixed: 'Mixed recorded indicators',
    cust_health_cat_attention: 'Needs attention',
    cust_card_archived: 'Archived',
    cust_card_open_profile_title: 'Open customer profile for #{number}, {name}. Total actual receipts: {receipts}. {health}. Time with ISP: {tenurePrimary}. {tenureDetail}.',
    cust_card_chip_fee: 'Rs {amount}/mo',
    cust_bill_not_set: 'Bill not set',
    cust_bill_paid: 'Paid',
    cust_bill_pending: 'Pending',
    cust_bill_partial: 'Partial',
    cust_not_set: 'Not set',
    cust_service_active: 'Active',
    cust_service_offline: 'Offline',
    cust_service_status_chip: 'Service status: {status}',
    cust_service_button_aria: 'Set customer {number} manual service status to {status}',
    cust_service_group_aria: 'Manual service status for customer {number}, {name}',
    cust_card_bill_badge_aria: '{chip} — Billing status for {month}: {label}. Click to {action} monthly bill inline.',
    cust_card_bill_action_edit: 'edit',
    cust_card_bill_action_set: 'set',
    cust_card_unarchive: 'Unarchive',
    cust_tenure_months: '{months} calendar months',
    cust_tenure_connected_since: 'Connected since {date}',
    cust_tenure_ended: 'Service ended {date}',
    cust_tenure_not_started: 'Not started',
    cust_tenure_recorded_date: 'Recorded connection date {date}',
    cust_tenure_end_unknown: 'End date not recorded',
    cust_tenure_connected_duration_unknown: 'Connected since {date} · duration unavailable',
    cust_tenure_check_dates: 'Check connection dates',
    cust_tenure_end_before_connection: 'Saved end date {date} is before connection',
    cust_tenure_not_recorded: 'Not recorded',
    cust_tenure_profile_added: 'Profile added {date} · ISP start not recorded',
    cust_tenure_connection_not_recorded: 'Connection date not recorded',
    cust_table_open_profile_title: 'Open profile for #{number} {name}',
    cust_table_open: 'Open →',
    cust_table_archived: '(Archived)',
    cust_table_empty: 'No customers found.',
    cust_table_empty_query_area: 'No customers matching "{query}" in {area}.',
    cust_table_empty_query: 'No customers matching "{query}".',
    cust_table_empty_area: 'No customers found in {area}.',
    cust_table_reset: 'Reset Filters & Search',
    cust_density_compact: '▤ Compact list',
    cust_density_detailed: '☰ Show details',
    cust_density_compact_title: 'One line per customer',
    cust_density_detailed_title: 'Show receipts, tenure, health and service buttons on each card',
    cust_pull_refresh: 'Pull to refresh',
    cust_local_ledger: 'LOCAL LEDGER',
    cust_heading_customers: 'Customers',
    cust_wizard: '📱 Wizard',
    cust_wizard_title: 'Open Mobile Field Technician Enrollment Wizard',
    cust_add_customer: 'Add customer',
    cust_billing_month: 'Billing month',
    cust_service_label: 'Service',
    cust_service_filter_aria: 'Filter by manual service status; counts exclude archived profiles',
    cust_service_active_aria: 'Active — Filter by manual service status',
    cust_service_offline_aria: 'Offline — Filter by manual service status',
    cust_service_not_set_aria: 'Not set — Filter by manual service status',
    cust_service_counts_loading: 'Manual service counts loading',
    cust_bill_status_label: 'Bill status',
    cust_bill_filter_aria: 'Filter by billing status for selected month',
    cust_all_incl_not_set: 'All (incl. Not set)',
    cust_filter_help_aria: 'Service and billing status guidance',
    cust_filter_help: 'Service status is set by the operator and is not monitored. Billing status is derived from the saved bill amount, actual receipts, and carried credit.',
    cust_area_label: 'Area / Mohalla',
    cust_filter_area_aria: 'Filter roster by area or mohalla',
    cust_sort_label: 'Sort roster',
    cust_sort_roster_aria: 'Sort customer roster',
    cust_sort_number_asc: 'Customer # (1 → 99)',
    cust_sort_number_desc: 'Customer # (99 → 1)',
    cust_sort_name_asc: 'Name (A → Z)',
    cust_sort_name_desc: 'Name (Z → A)',
    cust_sort_mohalla_asc: 'Area (A → Z)',
    cust_sort_balance_desc: 'Dues / Balance (High → Low)',
    cust_sort_balance_asc: 'Dues / Balance (Low → High)',
    cust_sort_received_desc: 'Collected (High → Low)',
    cust_view_layout_aria: 'Roster view layout',
    cust_cards: '🗂️ Cards',
    cust_cards_title: 'Card View',
    cust_table: '📋 Table',
    cust_table_title: 'Table View',
    cust_expand: '⛶ Expand',
    cust_expand_title: 'Maximize Table / Full Screen Width',
    cust_export_roster: '📥 Export CSV',
    cust_export_roster_title: 'Export customer roster to CSV',
    cust_search_list_label: 'Search this list',
    cust_search_placeholder: 'Name, phone, customer # or ID',
    cust_search_clear: 'Clear',
    cust_search_clear_aria: 'Clear customer-list search',
    cust_search_help: 'Matches customer name, phone, customer number or record ID; combines with each bill-status filter. When blank, global search also filters this list.',
    cust_newcust_panel_aria: 'New customers by month',
    cust_list_aria: 'Customer list',
    cust_profiles_aria: 'Customer profiles',
    cust_filters_aria: 'Customer filters',
    cust_table_aria: 'Customer Roster Table',
    cust_th_customer: 'Customer',
    cust_th_area: 'Area / Mohalla',
    cust_th_plan: 'Plan',
    cust_th_service: 'Service',
    cust_th_status: 'Status',
    cust_th_balance: 'Balance Due',
    cust_th_action: 'Action',
    cust_pagination_aria: 'Customer list pagination',
    cust_prev: '← Previous',
    cust_prev_aria: 'Previous customer page',
    cust_next: 'Next →',
    cust_next_aria: 'Next customer page',
    cust_per_page: 'Per page',
    cust_per_page_aria: 'Customers per page',
    cust_archived: 'Archived customers',
    cust_archived_list_aria: 'Archived customer profiles',
    cust_footer: 'Billing entries never leave this browser.',
    cust_welcome_eyebrow: 'CUSTOMER LEDGER',
    cust_welcome_heading: 'Select a customer to open their ledger',
    cust_welcome_pick: 'Pick a customer from the list to see their bills, payments and history, or use + Add Customer.',
    cust_welcome_count_suffix: 'customers · up to 24 months per customer',

    // Dashboard screen — Urdu auto-translation phase 2
    dash_eyebrow_live: 'LIVE SUMMARY',
    dash_title: 'Billing dashboard',
    dash_units: 'All money shown in PKR · no conversion.',
    dash_add_payment: '+ Add payment',
    dash_guidance_aria: 'Billing dashboard guidance',
    dash_guidance: 'Saved selling prices create month-specific bill snapshots beginning at their effective Pakistan local month. New monthly bills default to the 5th; saved custom due dates are preserved. Actual receipts apply to the selected month first; excess may be allocated as credit to later generated bills. Credit is not a second payment. Archived customers receive no new bills. Editing a price does not rewrite older snapshots, and no late penalty is invented. Expected package margin and provider cost are estimates, not collected cash.',
    dash_kpi_region_aria: 'Key performance indicators',
    dash_kpi_today: 'Today Collected',
    dash_kpi_today_sub: 'Today\'s cash',
    dash_kpi_month: 'Month Collected / Billed',
    dash_kpi_month_sub_default: 'Current month',
    dash_kpi_dues: 'Total Dues',
    dash_kpi_dues_sub: 'Outstanding balance',
    dash_kpi_defaulters: 'Customers with Dues',
    dash_kpi_defaulters_sub: 'Pending accounts',
    dash_actions_region_aria: 'Primary billing actions',
    dash_tile_collect_aria: 'Payment lo — Receive customer payment (Record customer receipt)',
    dash_tile_collect_title: 'Payment lo',
    dash_tile_collect_sub: 'Receive customer payment',
    dash_tile_customer_aria: 'Customer add - New connection profile',
    dash_tile_customer_title: 'Customer add',
    dash_tile_customer_sub: 'New connection profile',
    dash_tile_dues_aria: 'Dues list — Recovery & defaulters (Top defaulters and recovery)',
    dash_tile_dues_title: 'Dues list',
    dash_tile_dues_sub: 'Recovery & defaulters',
    dash_tile_closing_aria: 'Aaj ka hisaab — Cash till & closing (Cash register & daily closing)',
    dash_tile_closing_title: 'Aaj ka hisaab',
    dash_tile_closing_sub: 'Cash till & closing',
    dash_today_badge: '📅 Aaj · Today',
    dash_today_heading: "Today's Summary · آج کا خلاصہ",
    dash_today_wa_aria: 'Send to my WhatsApp (daily summary)',
    dash_today_wa_text: 'Send to my WhatsApp',
    dash_today_label_collected: 'Collected Today (آج کی وصولی)',
    dash_today_label_target: 'Month Target (ماہانہ وصولی)',
    dash_today_label_dues: 'Total Dues (کل واجبات)',
    dash_today_label_new: 'New Customers (نئے صارفین)',
    dash_today_sub_connected: 'Connected this month',
    dash_today_overdue_title: 'Top 5 Overdue Accounts · بڑے بقایاجات',
    dash_today_overdue_all: 'View all dues →',
    dash_today_overdue_aria: 'Top 5 overdue customer accounts',
    dash_summary_grid_aria: 'Live billing totals',
    dash_today_sub_default: 'Live closing register & collection status',
    dash_card_closing: 'Daily Register & Closing',
    dash_closing_badge_default: 'No Activity',
    dash_closing_benchmark: 'Benchmark target: calculating...',
    dash_btn_cash_suite: '📊 Cash Closing Suite',
    dash_btn_daily_register: '📖 Daily Register',
    dash_btn_daily_slip: '📋 Daily Slip',
    dash_btn_staff_perf: '👥 Staff Performance',
    dash_card_shop: '🏪 Shop Cash Collection & Handover',
    dash_btn_shop_settlement: '🏪 Shop Settlement',
    dash_card_cycle: '📅 Monthly Billing Cycle',
    dash_btn_billing_cycle: '📅 Billing Cycle',
    dash_card_complaint: '🛠️ Complaint Register',
    dash_card_tickets: '🔧 Field Tickets',
    dash_card_downtime: '📉 Downtime Analytics',
    dash_card_splitter: '🔌 Splitter Port Map',
    dash_card_monthly_report: '📋 Monthly Complaint Report',
    dash_btn_monthly_report: '📋 Monthly Report',
    dash_card_roznamcha: '📒 Daily Roznamcha',
    dash_card_stock: '📦 Stock Book',
    dash_card_outage: '⚡ Feeder Outage Impact',
    dash_btn_trace_outage: '⚡ Trace Outage Impact',
    dash_card_saad: '🔧 Saad Visit Log',
    dash_btn_saad_visits: '🔧 Saad Visits',
    dash_card_install: '📡 Installation Tracker',
    dash_card_pending: '📌 Pending Works',
    dash_card_pole: '📍 Pole & Landmark Directory',
    dash_btn_cheatsheet: '📍 Zone Lineman Cheat-Sheet',
    dash_card_group: '👨‍👩‍👧 Group Billing',
    dash_card_recovery: '📦 Pending Hardware Recovery',
    dash_card_khata: '📕 Owner Khata Closing',
    dash_card_wallet: '💳 Digital Wallet Ledger',
    dash_card_month_due: 'This month’s due amount',
    dash_card_total_due: 'Total due bill',
    dash_card_today_coll: 'Today’s collection',
    dash_card_month_coll: 'This month’s collection',
    dash_card_month_billed: 'Monthly billed revenue',
    dash_card_expenses: 'Recorded expenses · this month',
    dash_card_profit: 'Net cash profit · this month',
    dash_card_profiles: 'Customer profiles',
    dash_card_active: 'Active subscribers',
    dash_card_bill_status: 'Bill status · this month',
    dash_card_new_conn: 'New connections · this month',
    dash_card_velocity: 'Collection velocity & projection',
    dash_card_total_coll: 'Total collection',
    dash_card_credit: 'Unused prepaid credit',
    dash_card_prev_coll: 'Previous month’s collection',
    dash_card_exp_profit: 'Expected monthly package profit',
    dash_card_prov_cost: 'Expected monthly provider cost',
    dash_velocity_aria: 'Collection rate of billed amount',
    dash_target_title: 'Monthly Collection vs Target',
    dash_target_sub: 'Target achievement, daily run-rate, and month-end projection',
    dash_btn_target: 'Set / Manage Target',
    dash_target_gauge_aria: 'Monthly collection vs target radial gauge',
    dash_worklists_title: 'Disconnection & Reconnection Worklists',
    dash_worklists_sub: 'Field service actions: overdue suspensions & paid restorations',
    dash_btn_worklists: 'View Worklists / فہرست کھولیں',
    dash_worklists_disc: 'To Disconnect',
    dash_worklists_rec: 'To Reconnect',
    dash_worklists_ready: 'Dues cleared · ready',
    dash_charts_collapse: '📊 Performance & Collection Analytics',
    dash_charts_badge: 'Charts',
    dash_charts_heading: 'Performance & Collection Analytics',
    dash_prov_eyebrow: 'RECURRING ESTIMATE',
    dash_prov_heading: 'Monthly provider cost by ISP (PKR)',
    dash_prov_explainer: 'Uses each active profile’s saved monthly purchase cost only. Missing costs are excluded; provider names are never guessed.',
    dash_prov_empty: 'No provider-cost entries have been configured.',
    dash_owner_eyebrow: 'LOCAL-ONLY · READ-ONLY ANSWERS',
    dash_owner_heading: 'Owner Command Center',
    dash_owner_note: 'Ask about saved bills, receipts, customers and expenses. Nothing is edited by a question.',
    dash_owner_badge: 'Works offline',
    dash_owner_input_label: 'Ask in English, Roman Urdu or Urdu',
    dash_owner_placeholder: 'October collection? · Ali ka balance? · آج کی collection؟',
    dash_owner_voice_btn: 'Voice · on-device only',
    dash_owner_ask: 'Ask',
    dash_owner_voice_label: 'Voice language',
    dash_owner_voice_note: 'Voice starts only if this browser confirms an installed local speech model. Roman Urdu typed commands remain available.',
    dash_overhead_due: 'Upstream bandwidth bill not yet paid for {month} — post it before the month closes so profit and partner shares stay true.',
    dash_overhead_btn: 'Post overhead',
    dash_shop_empty: 'No shop collections',
    dash_shop_empty_period: 'Unsettled cash sitting at shops',
    dash_shop_sing: '{count} shop',
    dash_shop_plur: '{count} shops',
    dash_shop_receipt_sing: '{count} pending receipt',
    dash_shop_receipt_plur: '{count} pending receipts',
    dash_shop_detail: '{collected} this month · last handover {date}',
    dash_shop_never: 'never',
    dash_cycle_empty: 'No cycle run yet',
    dash_cycle_cycled: '{month} cycled',
    dash_cycle_period_empty: 'Run a monthly cycle with arrears & advance',
    dash_cycle_bills: '{count} bills · {amount} net expected',
    dash_cycle_billed: '{amount} billed',
    dash_cycle_arrears: '{amount} arrears carried',
    dash_complaint_empty: 'No complaints',
    dash_complaint_open: '{open} open · {inProgress} in progress',
    dash_complaint_period_empty: 'Open faults and resolution downtime',
    dash_complaint_period: '{resolved} resolved · {count} this month · {hours} h downtime',
    dash_detail_open_now: 'Open now',
    dash_detail_progress_resolved: '{inProgress} in progress · {resolved} resolved',
    dash_ticket_empty: 'No field tickets',
    dash_ticket_period_empty: 'Lineman worklist and material use',
    dash_ticket_period: '{resolved} resolved · PKR {charges} pending ticket charges',
    dash_downtime_empty: 'No downtime',
    dash_downtime_value: '{hours} h downtime',
    dash_downtime_period_empty: 'Per-customer and network outage hours',
    dash_downtime_period: '{count} complaints · {customers} customers affected',
    dash_downtime_top: 'Top customer',
    dash_downtime_detail: '{count} zone-wide faults · {hours} h',
    dash_splitter_empty: 'No splitter boxes',
    dash_splitter_box_sing: '{count} box',
    dash_splitter_box_plur: '{count} boxes',
    dash_splitter_ports: '{count} ports used',
    dash_splitter_period_empty: 'Splitter box port map and RX signal health',
    dash_splitter_spare_sing: '{count} spare port',
    dash_splitter_spare_plur: '{count} spare ports',
    dash_splitter_weak_sing: '{count} weak signal',
    dash_splitter_weak_plur: '{count} weak signals',
    dash_splitter_no_weak: 'no weak signals',
    dash_splitter_weakest: 'Weakest signal',
    dash_splitter_port: 'port {port}',
    dash_report_period_empty: '4-part monthly report: summary, customers, causes, full log',
    dash_report_value: '{count} complaints · {hours} h net off',
    dash_report_period: '{resolved} resolved · {pending} pending · {hours} h Fiber Cut',
    dash_report_complaints: '{name} · {count} complaints',
    dash_roz_closed: 'Closed · {amount}',
    dash_roz_expected: '{amount} expected',
    dash_roz_farq: 'Farq {amount}',
    dash_roz_cash: 'Cash in {amount} · petty out {out}',
    dash_roz_opening: 'Opening',
    dash_roz_detail: '{cash} cash payments · {handovers} shop handovers',
    dash_inv_empty: 'No stock recorded',
    dash_inv_low_sing: '{count} low-stock item',
    dash_inv_low_plur: '{count} low-stock items',
    dash_inv_period_empty: 'Fiber, routers, converters & field stock',
    dash_inv_move_sing: '{count} movement recorded',
    dash_inv_move_plur: '{count} movements recorded',
    dash_inv_fiber_left: 'Fiber left',
    dash_outage_empty: 'No feeder links',
    dash_outage_linked: '{count} feeder-linked',
    dash_outage_period_empty: 'Link customers to feeders to trace outages',
    dash_outage_chain: 'Longest chain: {count} downstream at risk',
    dash_outage_chain_label: 'Longest chain',
    dash_outage_downstream: '{name} · {count} downstream',
    dash_saad_empty: 'No visits yet',
    dash_saad_visit_sing: '{count} visit',
    dash_saad_visit_plur: '{count} visits',
    dash_saad_day_sing: '{count} day',
    dash_saad_day_plur: '{count} days',
    dash_saad_period_empty: 'Saad field visits, hours & payments',
    dash_saad_period: '{hours} hours worked · {amount} PKR paid',
    dash_detail_latest: 'Latest',
    dash_install_empty: 'No requests yet',
    dash_install_req_sing: '{count} request',
    dash_install_req_plur: '{count} requests',
    dash_install_installed: '{count} installed',
    dash_install_period_empty: 'New connection requests & install delays',
    dash_install_period: '{pending} pending · {days} total delay days',
    dash_pending_empty: 'Nothing pending',
    dash_pending_due: '{count} due now',
    dash_pending_count: '{count} pending',
    dash_pending_nearest: 'Nearest: {label}',
    dash_pending_period_empty: 'Owner notes & reminders',
    dash_pending_due_label: '⚠️ Due',
    dash_pole_empty: 'No poles mapped',
    dash_pole_map_sing: '{count} pole mapped',
    dash_pole_map_plur: '{count} poles mapped',
    dash_pole_period: '{total} customers · Street pole, landmark & drop-wire directory',
    dash_pole_label: 'Mapped',
    dash_pole_detail: '{mapped} of {total} customers',
    dash_group_empty: 'No groups yet',
    dash_group_period_empty: 'Family / landlord groups',
    dash_group_sing: '{count} group',
    dash_group_plur: '{count} groups',
    dash_group_dues: '{count} with dues',
    dash_group_collectible: 'Collectible total',
    dash_recovery_period_empty: 'ISP-owned hardware at disconnected houses',
    dash_recovery_cust_sing: '{count} customer',
    dash_recovery_cust_plur: '{count} customers',
    dash_recovery_item_sing: '{count} item',
    dash_recovery_item_plur: '{count} items',
    dash_recovery_period: 'Mark items recovered as they come back',
    dash_recovery_first: 'First pending',
    dash_khata_empty: 'No activity',
    dash_khata_profit: '{amount} net profit',
    dash_khata_period: '{month} · collected {collected} · arrears {arrears}',
    dash_khata_shares: 'Shares',
    dash_khata_partners: 'Nasir / Aqib',
    dash_khata_detail: '{complaints} complaints · {hours} h offline',
    dash_wallet_empty: 'No digital payments',
    dash_wallet_period_empty: 'EasyPaisa · JazzCash · NayaPay · Bank Transfer',
    dash_wallet_pending: '{count} pending verification',
    dash_wallet_dup_sing: '{count} duplicate TID',
    dash_wallet_dup_plur: '{count} duplicate TIDs',
    dash_wallet_pay_sing: '{count} payment',
    dash_wallet_pay_plur: '{count} payments',
    dash_wallet_verified: '{count} verified',
    dash_service_active_aria: 'Active {count} — Filter by manual service status ({count} unarchived)',
    dash_service_offline_aria: 'Offline {count} — Filter by manual service status ({count} unarchived)',
    dash_service_notset_aria: 'Not set {count} — Filter by manual service status ({count} unarchived)',
    dash_service_announce: 'Manual service counts, excluding archived profiles: Active {active} · Offline {offline} · Not set {notset}',
    dash_no_payments: 'No payment entries',
    dash_no_bills: 'No bill entries',
    dash_not_set: 'Not set',
    dash_no_entries: 'No entries',
    dash_no_activity: 'No recorded activity',
    dash_no_credit: 'No credit entries',
    dash_expenses_period: 'Actual dated expenses · {month}',
    dash_profit_period: '{collection} actual receipts − {expenses} recorded expenses',
    dash_coll_period: 'Actual recorded payments · last {months} retained billing months',
    dash_coll_period_empty: 'No actual payment entries in the retained history',
    dash_due_period: 'Known outstanding bills · retained {months}-month history',
    dash_due_period_empty: 'No bills have been recorded in the retained history',
    dash_today_period: 'Actual payments dated today · {date}',
    dash_prev_period: 'Actual payment dates in {month}',
    dash_current_due_period: 'Current billing month · {month}',
    dash_current_due_suffix: ' · no bill entries',
    dash_margin_note: 'Selling amount − provider cost · expected margin, not collected cash profit',
    dash_customer_period: '{archived} archived · {total} unarchived profiles; service state is manual',
    dash_provcost_period: 'Expected recurring monthly cost · not cash paid',
    dash_provcost_empty: 'No provider-cost entries · not cash paid',
    dash_provcost_cost_sing: '{count} cost entered',
    dash_provcost_cost_plur: '{count} costs entered',
    dash_provcost_missing: '{count} missing',
    dash_excluded_default: 'Dues use each saved month’s bill snapshot after receipts and carry-forward credit; credits are not new cash.',
    dash_note_selling_sing: 'Selling amount unset for {count} customer; no monthly bills are generated until a price is entered.',
    dash_note_selling_plur: 'Selling amount unset for {count} customers; no monthly bills are generated until a price is entered.',
    dash_note_unpriced_sing: '{count} pending bill without a recorded amount are excluded from due totals.',
    dash_note_unpriced_plur: '{count} pending bills without a recorded amount are excluded from due totals.',
    dash_note_profit_sing: 'Profit not set for {count} profile missing a selling amount or provider cost; excluded from expected package profit.',
    dash_note_profit_plur: 'Profit not set for {count} profiles missing a selling amount or provider cost; excluded from expected package profit.',
    dash_note_provcost_sing: 'Provider cost not set for {count} active profile; excluded from expected monthly provider cost.',
    dash_note_provcost_plur: 'Provider cost not set for {count} active profiles; excluded from expected monthly provider cost.',
    dash_kpi_active_period: '{offline} offline · {notset} not set',
    dash_billstatus_empty: 'No bills recorded for current month',
    dash_billstatus_value: '{paid} paid · {unpaid} unpaid',
    dash_billstatus_period: '{partial} partial · {total} total bills in {month}',
    dash_billed_rate: 'Collection rate {rate}% of billed amount',
    dash_billed_period: 'Priced snapshots · {month}',
    dash_monthcoll_sing: '{count} receipt dated in {month}',
    dash_monthcoll_plur: '{count} receipts dated in {month}',
    dash_newconn_period: 'Recorded in {month}',
    dash_velocity_day: '{amount} / day',
    dash_velocity_proj: 'Projected: {amount} ({rate}% of billed) · {days} days left',
    dash_velocity_days: 'Day {day} of {daysInMonth} · {days} days remaining',
    dash_kpi_rate: '{rate}% collected',
    dash_kpi_rate_zero: '0% collected',
    dash_defaulters_sing: '{count} customer',
    dash_defaulters_plur: '{count} customers',
    dash_worklist_dues: '{amount} dues (> {days}d)',
    dash_today_live_suffix: 'Live closing register & collections',
    dash_today_cash_digital: 'Cash: {cash} · Digital: {digital}',
    dash_today_billed: '{collected} / {billed} billed',
    dash_today_dues_count: '{count} accounts with dues',
    dash_today_no_overdue: '✅ No overdue accounts — all active customers cleared!',
    dash_today_wa_title: 'Send WhatsApp reminder',
    dash_today_wa_link_aria: 'Send WhatsApp to {name}',
    dash_today_collect_title: 'Collect payment',
    dash_today_collect_aria: 'Collect from {name}',
    dash_today_collect_text: 'Collect',
    dash_closing_target: 'Target: {target}/day ({pct}%) · Net Cash: {cash}',
    dash_closing_target_alt: 'Target: {target} / day · {pct}% attainment',
    dash_closing_status_no: 'No Activity Today',
    dash_closing_status_met: 'Target Met (100%+)',
    dash_closing_status_track: 'On Track',
    dash_closing_status_below: 'Below Target',
    dash_closing_copied: 'Daily closing slip copied to clipboard!',
    dash_closing_ready: 'Daily closing summary ready.',
    dash_chart_03_title: 'Revenue & Collections Trend',
    dash_chart_04_title: 'Current Month Bill Settlement',
    dash_chart_05_title: 'Outstanding Dues by Area',
    dash_chart_06_title: 'Package Tier Distribution',
    dash_chart_07_title: 'Customer Health & Delinquency Matrix',
    dash_chart_08_title: 'Payment Settlement Channels',
    dash_chart_09_title: 'Customer Retention & Churn Risk',
    dash_chart_10_title: 'Geographic Collection Heatmap',
    dash_chart_11_title: 'Seasonal Cashflow & Multi-Year Velocity',
    dash_chart_12_title: 'Package Margin & Wholesale Transit',
    dash_chart_13_title: 'Customer Lifetime Value (LTV) & Cohorts',
    dash_chart_14_title: 'Network Outages & Incident Matrix',
    dash_chart_15_title: 'Forward Cashflow & Churn Projections',
    dash_chart_16_title: 'Upstream ISP Transit & Failover',
    dash_chart_17_title: 'Subscriber Acquisition ROI & Payback',
    dash_chart_18_title: 'Peak Traffic & Bandwidth Shaping',
    dash_chart_19_title: 'Fiber Distribution Hubs & Splitter Matrix',
    dash_chart_20_title: 'Delinquency Recovery Pipeline & Escalation Pacing',
    dash_chart_21_title: 'CPE & ONU Asset Lifecycle Tracker',
    dash_chart_22_title: 'Power Outage & OLT Battery Health',
    dash_chart_23_title: 'Area Route Density & Collector Pacing',
    dash_chart_24_title: 'OTDR Fiber Fault Locator & Break Estimator',
    dash_chart_25_title: 'Solar Hybrid Inverter & Grid Load Shedding',
    dash_chart_26_title: 'Aerial Fiber Pole Tension & Catenary Sag',
    dash_chart_27_title: 'Microwave Backhaul Rain Fade & Link Budget',
    dash_chart_28_title: 'Aerial Fiber Splice Closures & Micro-Bend Loss',
    dash_chart_29_title: 'Underground Duct Jetting & Cable Friction',
    dash_chart_30_title: 'OLT PON Port DBA & Latency Queues',
    dash_chart_31_title: 'Fusion Splicer Arc Wear & Cleave Angle',
    dash_chart_32_title: 'Core BGP Peering & Route Flap Damping',
    dash_chart_33_title: 'Downstream IPTV Multicast & Zapping',
    dash_chart_34_title: 'Edge DNS Resolvers & DNSSEC Matrix',
    dash_chart_35_title: 'DWDM Optical Channels & OSNR Budget',
    dash_chart_36_title: 'Optical Supervisory Channel (OSC) & Loopback Matrix',
    dash_chart_37_title: 'Metro Ethernet QinQ & LACP Trunk Saturation',
    dash_chart_38_title: 'Carrier SyncE & IEEE 1588v2 PTP Clock Matrix',
    dash_chart_39_title: 'ROADM Flex-Grid WSS Optical Rerouting',
    dash_chart_40_title: 'SFP Micro-OTDR Transceiver Reflectometry',
    dash_chart_41_title: 'MC-LAG Dual-Chassis Redundancy Matrix',
    dash_chart_42_title: 'BGP Flowspec DDoS Mitigation Matrix',
    dash_chart_43_title: 'Optical Fiber Raman Amplifier (FRA) Matrix',
    dash_chart_44_title: 'Carrier Segment Routing (SR-MPLS / SRv6) Matrix',
    dash_chart_45_title: 'DWDM Polarization Mode Dispersion (PMD) Matrix',
    dash_chart_46_title: 'MP-BGP EVPN / VXLAN Network Virtualization Overlay Matrix',
    dash_chart_47_title: 'Optical Fiber Nonlinear Kerr Effects & Threshold Matrix',
    dash_chart_48_title: 'Core MPLS Traffic Engineering & FRR Headroom Matrix',
    dash_chart_49_title: 'Carrier Ethernet E-Line / E-LAN Bandwidth Profiles',
    dash_chart_50_title: 'Metro Ethernet Ring Protection (ITU-T G.8032 ERPS)',
    dash_chart_51_title: 'Carrier Ethernet OAM & PM (ITU-T Y.1731 / 802.1ag)',
    dash_chart_52_title: 'Carrier MPLS Pseudowire (VPWS / EoMPLS) Matrix',
    dash_chart_53_title: 'Carrier BFD (RFC 5880 / 5881 / 7130) Fault Detection Matrix',
    dash_chart_54_title: 'Carrier MPLS VPLS (RFC 4761 / 4762) Multi-Point Matrix',
    dash_chart_55_title: 'Brillouin Sensing (BOTDA / ITU-T G.650.2) DTSS Matrix',
    dash_chart_56_title: 'Carrier CGNAT (RFC 6598 / 7422) Port-Block Allocation Matrix',
    dash_chart_57_title: 'Optical OLT Chassis (ITU-T G.984 / G.9807.1) Capacity Matrix',
    dash_chart_58_title: 'Carrier SRv6 (RFC 8986 / 8754) Network Programming Matrix',
    dash_chart_59_title: 'Carrier Flex-Algo (RFC 9350 / 9351) Multi-Plane Matrix',
    dash_chart_60_title: 'Optical Modulation & Constellation EVM (ITU-T G.698.2) Matrix',
    dash_chart_61_title: 'Optical Transport Network (OTN - ITU-T G.709) Matrix',
    dash_chart_62_title: 'Carrier MPLS-TP (ITU-T G.8113.1) 1:1 Protection Matrix',
    dash_chart_63_title: 'Carrier BGP/MPLS IP VPN (L3VPN - RFC 4364) Multi-VRF Matrix',
    dash_chart_64_title: 'Carrier DWDM Cascaded EDFA & DGE Equalization Matrix',
    dash_chart_65_title: 'Carrier PTP IEEE 1588v2 Telecom Boundary Clock (T-BC) Matrix',
    dash_chart_66_title: 'Carrier BGP Route Origin Validation (ROV / RFC 6811) & Flap Damping Matrix',
    dash_chart_67_title: 'Carrier Coherent Optical Polarization Mode State & DSP Equalizer Matrix',
    dash_chart_68_title: 'Carrier RoCEv2 Lossless Fabric, Priority Flow Control (PFC) & ECN Matrix',
    dash_chart_69_title: 'Carrier Optical Line Protection (OLP 1+1) & Hitless Switch Matrix',
    dash_chart_03_sub: 'Billed snapshot revenue vs actual receipts dated in each month',
    dash_chart_04_sub: 'Paid, partial, and unpaid bills distribution',
    dash_chart_05_sub: 'Uncollected balances grouped by customer location',
    dash_chart_06_sub: 'Subscribers and monthly revenue by tier',
    dash_chart_07_sub: 'Account standing, watchlist, and overdue risk segments',
    dash_chart_08_sub: 'Cash vs digital wallet volume and transaction distribution',
    dash_chart_09_sub: 'Predictive risk gauge based on offline tenure and consecutive dues',
    dash_chart_10_sub: 'Collection efficiency & recovery rate by operational zone',
    dash_chart_11_sub: 'Jan–Dec collection trajectories and year-over-year pacing',
    dash_chart_12_sub: 'Upstream bandwidth cost vs gross profit contribution by tier',
    dash_chart_13_sub: 'Historical collected revenue and retention progression by tenure',
    dash_chart_14_sub: 'Area complaint frequency, MTTR recovery speed, and active downtime',
    dash_chart_15_sub: '6-month forward recurring revenue scenarios & collection curves',
    dash_chart_16_sub: 'Wholesale link latency, bandwidth capacity, and multi-homed routing',
    dash_chart_17_sub: 'Channel CAC economics, payback velocity, and marketing ROI',
    dash_chart_18_sub: 'Diurnal 24h utilization, contention ratios, and growth forecast',
    dash_chart_19_sub: 'Optical port allocation, dark fiber headroom, and attenuation tracking',
    dash_chart_20_sub: 'Aging stages, weighted recovery probability, and field collector pacing',
    dash_fallback_unknown: 'Unknown',
    dash_fallback_unnamed: 'Unnamed',
    dash_charts_eyebrow: 'VISUAL LEDGER INSIGHTS',
    dash_charts_caption: 'Pure client-side offline SVG charts. Real-time ledger calculations.',
    dash_prov_title: '💼 Monthly Provider Cost Breakdown',
    dash_btn_roznamcha: '📒 Roznamcha',
    dash_btn_wallet: '💳 Wallet Ledger',
    dash_closing_value: '{amount} ({count} txs)',

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

    // Customers page — Urdu auto-translation phase 1 (roster + new-customers panel)
    cust_new_customers_eyebrow: 'نئے گاہک',
    cust_new_customers_by_month: 'ماہ کے حساب سے نئے گاہک',
    cust_newcust_this_month: 'اس مہینے',
    cust_newcust_last_month: 'پچھلا مہینہ',
    cust_newcust_last_3_months: 'آخری 3 مہینے',
    cust_newcust_last_6_months: 'آخری 6 مہینے',
    cust_newcust_month_label: 'مہینہ',
    cust_newcust_choose_month: 'مہینہ منتخب کریں…',
    cust_newcust_count: '{count} نئے گاہک',
    cust_newcust_connection_fees: 'کنکشن فیس',
    cust_newcust_routers: 'روٹر',
    cust_newcust_fiber: 'فائبر',
    cust_newcust_fiber_meters: '{meters} میٹر',
    cust_newcust_empty: 'اس منظر میں کوئی نیا گاہک نہیں ہے۔',
    cust_newcust_note: 'شمولیتی گنتی میں بعد میں آرکائیو شدہ گاہک بھی شامل ہیں۔',
    cust_newcust_undated: '{count} گاہک کی شمولیت کی تاریخ نہیں ہے (تاریخیں درج ہونے سے پہلے شامل ہوئے) اور وہ کسی مہینے میں شمار نہیں ہوتے۔',
    cust_newcust_area_not_set: 'علاقہ درج نہیں',
    cust_newcust_joined: '{month} کو شامل ہوئے',
    cust_newcust_fee: 'فیس {amount}',
    cust_newcust_router: 'روٹر {model}',
    cust_newcust_fiber_m: '{meters} میٹر فائبر',
    cust_newcust_install_surplus: 'انسٹالیشن: خالص بچت {amount}',
    cust_newcust_install_subsidy: 'انسٹالیشن: ISP سبسڈی {amount}',
    cust_newcust_install_breakeven_suffix: ' · بریک ایون {months} بل',
    cust_newcust_install_breakeven: 'انسٹالیشن: بریک ایون',
    cust_newcust_install_unknown: 'انسٹالیشن لاگت {cost} · فیس درج نہیں',
    cust_newcust_onboarding_none: 'شمولیتی تفصیلات درج نہیں',
    cust_newcust_quick_views_aria: 'نئے گاہکوں کے فوری مناظر',
    cust_month_jan: 'جنوری',
    cust_month_feb: 'فروری',
    cust_month_mar: 'مارچ',
    cust_month_apr: 'اپریل',
    cust_month_may: 'مئی',
    cust_month_jun: 'جون',
    cust_month_jul: 'جولائی',
    cust_month_aug: 'اگست',
    cust_month_sep: 'ستمبر',
    cust_month_oct: 'اکتوبر',
    cust_month_nov: 'نومبر',
    cust_month_dec: 'دسمبر',
    cust_all_areas: 'تمام علاقے',
    cust_page_info: 'صفحہ {page} از {totalPages} ({total} کل)',
    cust_no_matching: 'کوئی مماثل گاہک نہیں ملا۔',
    cust_no_match_filters: 'کوئی گاہک ان سروس اور بلنگ فلٹرز سے مطابقت نہیں رکھتا۔',
    cust_card_actually_received: 'اصل میں وصول شدہ',
    cust_card_time_with_isp: 'ISP کے ساتھ مدت',
    cust_card_no_receipts: 'کوئی رسید نہیں',
    cust_card_no_payment_entries: 'کوئی ادائیگی درج نہیں',
    cust_card_recorded_receipts: '{count} ریکارڈ شدہ رسیدیں',
    cust_card_package_not_set: 'پیکیج منتخب نہیں',
    cust_card_open_hint: 'مکمل پروفائل اور ماہانہ بلنگ تاریخ کھولیں',
    cust_card_health: 'صحت',
    cust_card_health_reasons: 'صحت کی وجوہات',
    cust_card_health_none: 'خودکار اسکور کے لیے مکمل قیمت والے مہینے کافی نہیں ہیں۔',
    cust_health_cat_insufficient: 'ناکافی ریکارڈ',
    cust_health_cat_insufficient_metrics: 'ناکافی ریکارڈ',
    cust_health_cat_strong: 'مضبوط اشارے',
    cust_health_cat_mixed: 'ملے جلے اشارے',
    cust_health_cat_attention: 'توجہ درکار',
    cust_card_archived: 'آرکائیو شدہ',
    cust_card_open_profile_title: 'گاہک #{number}، {name} کا پروفائل کھولیں۔ کل اصل وصولیاں: {receipts}۔ {health}۔ ISP کے ساتھ مدت: {tenurePrimary}۔ {tenureDetail}۔',
    cust_card_chip_fee: 'Rs {amount}/ماہ',
    cust_bill_not_set: 'بل طے نہیں',
    cust_bill_paid: 'ادا شدہ',
    cust_bill_pending: 'زیر التوا',
    cust_bill_partial: 'جزوی',
    cust_not_set: 'منتخب نہیں',
    cust_service_active: 'فعال',
    cust_service_offline: 'آف لائن',
    cust_service_status_chip: 'سروس کی حالت: {status}',
    cust_service_button_aria: 'گاہک {number} کی دستی سروس حالت {status} پر مقرر کریں',
    cust_service_group_aria: 'گاہک {number}، {name} کی دستی سروس حالت',
    cust_card_bill_badge_aria: '{chip} — {month} کے لیے بلنگ حالت: {label}۔ ماہانہ بل ان لائن {action} کرنے کے لیے کلک کریں۔',
    cust_card_bill_action_edit: 'ترمیم',
    cust_card_bill_action_set: 'طے',
    cust_card_unarchive: 'آرکائیو سے بحال کریں',
    cust_tenure_months: '{months} کیلنڈر ماہ',
    cust_tenure_connected_since: '{date} سے منسلک',
    cust_tenure_ended: 'سروس {date} کو ختم ہوئی',
    cust_tenure_not_started: 'ابھی شروع نہیں ہوئی',
    cust_tenure_recorded_date: 'درج شدہ کنکشن تاریخ {date}',
    cust_tenure_end_unknown: 'اختتامی تاریخ درج نہیں',
    cust_tenure_connected_duration_unknown: '{date} سے منسلک · مدت دستیاب نہیں',
    cust_tenure_check_dates: 'کنکشن تاریخیں چیک کریں',
    cust_tenure_end_before_connection: 'محفوظ شدہ اختتامی تاریخ {date} کنکشن سے پہلے ہے',
    cust_tenure_not_recorded: 'درج نہیں',
    cust_tenure_profile_added: 'پروفائل {date} کو شامل ہوئی · ISP آغاز درج نہیں',
    cust_tenure_connection_not_recorded: 'کنکشن تاریخ درج نہیں',
    cust_table_open_profile_title: 'گاہک #{number} {name} کا پروفائل کھولیں',
    cust_table_open: 'کھولیں ←',
    cust_table_archived: '(آرکائیو شدہ)',
    cust_table_empty: 'کوئی گاہک نہیں ملا۔',
    cust_table_empty_query_area: 'کوئی گاہک "{query}" سے {area} میں مماثل نہیں ملا۔',
    cust_table_empty_query: 'کوئی گاہک "{query}" سے مماثل نہیں ملا۔',
    cust_table_empty_area: '{area} میں کوئی گاہک نہیں ملا۔',
    cust_table_reset: 'فلٹرز اور تلاش صاف کریں',
    cust_density_compact: '▤ مختصر فہرست',
    cust_density_detailed: '☰ تفصیلات دکھائیں',
    cust_density_compact_title: 'ہر گاہک کے لیے ایک سطر',
    cust_density_detailed_title: 'ہر کارڈ پر رسیدیں، مدت، صحت اور سروس بٹن دکھائیں',
    cust_pull_refresh: 'ریفریش کرنے کے لیے کھینچیں',
    cust_local_ledger: 'مقامی لیجر',
    cust_heading_customers: 'گاہک',
    cust_wizard: '📱 وزرڈ',
    cust_wizard_title: 'موبائل فیلڈ ٹیکنیشن اندراج وزرڈ کھولیں',
    cust_add_customer: 'گاہک شامل کریں',
    cust_billing_month: 'بلنگ مہینہ',
    cust_service_label: 'سروس',
    cust_service_filter_aria: 'دستی سروس حالت کے حساب سے فلٹر کریں؛ گنتی میں آرکائیو شدہ پروفائلز شامل نہیں',
    cust_service_active_aria: 'فعال — دستی سروس حالت کے حساب سے فلٹر کریں',
    cust_service_offline_aria: 'آف لائن — دستی سروس حالت کے حساب سے فلٹر کریں',
    cust_service_not_set_aria: 'منتخب نہیں — دستی سروس حالت کے حساب سے فلٹر کریں',
    cust_service_counts_loading: 'دستی سروس گنتی لوڈ ہو رہی ہے',
    cust_bill_status_label: 'بل کی حالت',
    cust_bill_filter_aria: 'منتخب مہینے کی بلنگ حالت کے حساب سے فلٹر کریں',
    cust_all_incl_not_set: 'تمام (بشمول منتخب نہیں)',
    cust_filter_help_aria: 'سروس اور بلنگ حالت کے بارے میں رہنمائی',
    cust_filter_help: 'سروس کی حالت آپریٹر مقرر کرتا ہے اور اس کی نگرانی نہیں ہوتی۔ بلنگ کی حالت محفوظ شدہ بل کی رقم، اصل رسیدوں اور منتقل شدہ کریڈٹ سے اخذ کی جاتی ہے۔',
    cust_area_label: 'علاقہ / محلہ',
    cust_filter_area_aria: 'علاقہ یا محلے کے حساب سے فہرست فلٹر کریں',
    cust_sort_label: 'فہرست ترتیب دیں',
    cust_sort_roster_aria: 'گاہکوں کی فہرست ترتیب دیں',
    cust_sort_number_asc: 'گاہک نمبر (1 → 99)',
    cust_sort_number_desc: 'گاہک نمبر (99 → 1)',
    cust_sort_name_asc: 'نام (A → Z)',
    cust_sort_name_desc: 'نام (Z → A)',
    cust_sort_mohalla_asc: 'علاقہ (A → Z)',
    cust_sort_balance_desc: 'واجب الادا / بیلنس (زیادہ سے کم)',
    cust_sort_balance_asc: 'واجب الادا / بیلنس (کم سے زیادہ)',
    cust_sort_received_desc: 'وصول شدہ (زیادہ سے کم)',
    cust_view_layout_aria: 'فہرست کی ترتیب',
    cust_cards: '🗂️ کارڈز',
    cust_cards_title: 'کارڈ منظر',
    cust_table: '📋 جدول',
    cust_table_title: 'جدول منظر',
    cust_expand: '⛶ پھیلائیں',
    cust_expand_title: 'جدول کو بڑا کریں / مکمل اسکرین چوڑائی',
    cust_export_roster: '📥 CSV برآمد کریں',
    cust_export_roster_title: 'گاہکوں کی فہرست CSV میں برآمد کریں',
    cust_search_list_label: 'اس فہرست میں تلاش کریں',
    cust_search_placeholder: 'نام، فون، گاہک نمبر یا ID',
    cust_search_clear: 'صاف کریں',
    cust_search_clear_aria: 'گاہکوں کی فہرست کی تلاش صاف کریں',
    cust_search_help: 'گاہک کے نام، فون، گاہک نمبر یا ریکارڈ ID سے مطابقت رکھتا ہے؛ ہر بل کی حالت کے فلٹر کے ساتھ ملتا ہے۔ خالی ہونے پر عالمی تلاش بھی اس فہرست کو فلٹر کرتی ہے۔',
    cust_newcust_panel_aria: 'ماہ کے حساب سے نئے گاہک',
    cust_list_aria: 'گاہکوں کی فہرست',
    cust_profiles_aria: 'گاہکوں کے پروفائلز',
    cust_filters_aria: 'گاہکوں کے فلٹرز',
    cust_table_aria: 'گاہکوں کی فہرست کا جدول',
    cust_th_customer: 'گاہک',
    cust_th_area: 'علاقہ / محلہ',
    cust_th_plan: 'پلان',
    cust_th_service: 'سروس',
    cust_th_status: 'حالت',
    cust_th_balance: 'واجب الادا بیلنس',
    cust_th_action: 'عمل',
    cust_pagination_aria: 'گاہکوں کی فہرست کی صفحہ بندی',
    cust_prev: 'پچھلا →',
    cust_prev_aria: 'گاہکوں کی فہرست کا پچھلا صفحہ',
    cust_next: 'اگلا ←',
    cust_next_aria: 'گاہکوں کی فہرست کا اگلا صفحہ',
    cust_per_page: 'فی صفحہ',
    cust_per_page_aria: 'فی صفحہ گاہک',
    cust_archived: 'آرکائیو شدہ گاہک',
    cust_archived_list_aria: 'آرکائیو شدہ گاہکوں کے پروفائلز',
    cust_footer: 'بلنگ اندراجات کبھی اس براؤزر سے باہر نہیں جاتے۔',
    cust_welcome_eyebrow: 'گاہک لیجر',
    cust_welcome_heading: 'لیجر کھولنے کے لیے ایک گاہک منتخب کریں',
    cust_welcome_pick: 'بل، ادائیگیاں اور تاریخ دیکھنے کے لیے فہرست سے ایک گاہک چنیں، یا + گاہک شامل کریں استعمال کریں۔',
    cust_welcome_count_suffix: 'گاہک · فی گاہک 24 مہینے تک',

    // Dashboard screen — Urdu auto-translation phase 2
    dash_eyebrow_live: 'براہ راست خلاصہ',
    dash_title: 'بلنگ ڈیش بورڈ',
    dash_units: 'تمام رقوم PKR میں دکھائی جاتی ہیں · کوئی تبدیلی نہیں۔',
    dash_add_payment: '+ ادائیگی شامل کریں',
    dash_guidance_aria: 'بلنگ ڈیش بورڈ رہنمائی',
    dash_guidance: 'محفوظ شدہ فروخت قیمتیں ان کے مؤثر پاکستانی مقامی مہینے سے مہینہ وار بل کی تصاویر بناتی ہیں۔ نئے ماہانہ بل عام طور پر 5 تاریخ کو بنتے ہیں؛ محفوظ شدہ اپنی مقررہ تاریخیں برقرار رہتی ہیں۔ اصل رسیدیں پہلے منتخب مہینے پر لاگو ہوتی ہیں؛ اضافی رقم بعد کے بلوں کے لیے کریڈٹ کے طور پر رکھی جا سکتی ہے۔ کریڈٹ دوسری ادائیگی نہیں ہے۔ آرکائیو شدہ گاہکوں کو نئے بل نہیں ملتے۔ قیمت بدلنے سے پرانے بل نہیں بدلتے، اور کوئی لیٹ جرمانہ خود سے نہیں لگایا جاتا۔ متوقع پیکیج مارجن اور فراہم کنندہ لاگت اندازے ہیں، وصول شدہ نقد رقم نہیں۔',
    dash_kpi_region_aria: 'اہم کارکردگی اشارے',
    dash_kpi_today: 'آج کی وصولی',
    dash_kpi_today_sub: 'آج کی نقد رقم',
    dash_kpi_month: 'ماہانہ وصولی / بل',
    dash_kpi_month_sub_default: 'رواں مہینہ',
    dash_kpi_dues: 'کل واجبات',
    dash_kpi_dues_sub: 'بقایا رقم',
    dash_kpi_defaulters: 'واجبات والے گاہک',
    dash_kpi_defaulters_sub: 'زیر التوا کھاتے',
    dash_actions_region_aria: 'اہم بلنگ اقدامات',
    dash_tile_collect_aria: 'ادائیگی لیں — گاہک کی ادائیگی وصول کریں (گاہک کی رسید درج کریں)',
    dash_tile_collect_title: 'ادائیگی لیں',
    dash_tile_collect_sub: 'گاہک کی ادائیگی وصول کریں',
    dash_tile_customer_aria: 'گاہک شامل کریں — نئے کنکشن کا پروفائل',
    dash_tile_customer_title: 'گاہک شامل کریں',
    dash_tile_customer_sub: 'نئے کنکشن کا پروفائل',
    dash_tile_dues_aria: 'واجبات کی فہرست — وصولی اور نادہندگان (بڑے نادہندگان اور وصولی)',
    dash_tile_dues_title: 'واجبات کی فہرست',
    dash_tile_dues_sub: 'وصولی اور نادہندگان',
    dash_tile_closing_aria: 'آج کا حساب — کیش اور بندش (کیش رجسٹر اور روزانہ بندش)',
    dash_tile_closing_title: 'آج کا حساب',
    dash_tile_closing_sub: 'کیش اور روزانہ بندش',
    dash_today_badge: '📅 آج',
    dash_today_heading: 'آج کا خلاصہ',
    dash_today_wa_aria: 'میرے واٹس ایپ پر بھیجیں (روزانہ خلاصہ)',
    dash_today_wa_text: 'میرے واٹس ایپ پر بھیجیں',
    dash_today_label_collected: 'آج کی وصولی',
    dash_today_label_target: 'ماہانہ ہدف',
    dash_today_label_dues: 'کل واجبات',
    dash_today_label_new: 'نئے گاہک',
    dash_today_sub_connected: 'اس مہینے منسلک ہوئے',
    dash_today_overdue_title: '5 بڑے بقایا کھاتے',
    dash_today_overdue_all: '← تمام واجبات دیکھیں',
    dash_today_overdue_aria: '5 بڑے بقایا گاہک کھاتے',
    dash_summary_grid_aria: 'براہ راست بلنگ مجموعے',
    dash_today_sub_default: 'براہ راست بندش رجسٹر اور وصولی کی حالت',
    dash_card_closing: 'روزانہ رجسٹر اور بندش',
    dash_closing_badge_default: 'کوئی سرگرمی نہیں',
    dash_closing_benchmark: 'معیار ہدف: حساب جاری ہے…',
    dash_btn_cash_suite: '📊 کیش بندش سوٹ',
    dash_btn_daily_register: '📖 روزانہ رجسٹر',
    dash_btn_daily_slip: '📋 روزانہ پرچی',
    dash_btn_staff_perf: '👥 عملے کی کارکردگی',
    dash_card_shop: '🏪 دکان کیش وصولی اور حوالگی',
    dash_btn_shop_settlement: '🏪 دکان تصفیہ',
    dash_card_cycle: '📅 ماہانہ بلنگ سائیکل',
    dash_btn_billing_cycle: '📅 بلنگ سائیکل',
    dash_card_complaint: '🛠️ شکایت رجسٹر',
    dash_card_tickets: '🔧 فیلڈ ٹکٹ',
    dash_card_downtime: '📉 ڈاؤن ٹائم تجزیہ',
    dash_card_splitter: '🔌 اسپلٹر پورٹ نقشہ',
    dash_card_monthly_report: '📋 ماہانہ شکایت رپورٹ',
    dash_btn_monthly_report: '📋 ماہانہ رپورٹ',
    dash_card_roznamcha: '📒 روزانہ روزنامچہ',
    dash_card_stock: '📦 اسٹاک کتاب',
    dash_card_outage: '⚡ فیڈر بندش کا اثر',
    dash_btn_trace_outage: '⚡ بندش کا اثر معلوم کریں',
    dash_card_saad: '🔧 سعد وزٹ لاگ',
    dash_btn_saad_visits: '🔧 سعد وزٹ',
    dash_card_install: '📡 انسٹالیشن ٹریکر',
    dash_card_pending: '📌 زیر التوا کام',
    dash_card_pole: '📍 پول اور نشانی ڈائریکٹری',
    dash_btn_cheatsheet: '📍 زون لائن مین چیٹ شیٹ',
    dash_card_group: '👨‍👩‍👧 گروپ بلنگ',
    dash_card_recovery: '📦 زیر التوا ہارڈویئر واپسی',
    dash_card_khata: '📕 مالک کھاتہ بندش',
    dash_card_wallet: '💳 ڈیجیٹل والیٹ لیجر',
    dash_card_month_due: 'اس مہینے کی واجب رقم',
    dash_card_total_due: 'کل واجب بل',
    dash_card_today_coll: 'آج کی وصولی',
    dash_card_month_coll: 'اس مہینے کی وصولی',
    dash_card_month_billed: 'ماہانہ بل شدہ آمدنی',
    dash_card_expenses: 'درج شدہ اخراجات · اس مہینے',
    dash_card_profit: 'خالص نقد منافع · اس مہینے',
    dash_card_profiles: 'گاہک پروفائلز',
    dash_card_active: 'فعال صارفین',
    dash_card_bill_status: 'بل کی حالت · اس مہینے',
    dash_card_new_conn: 'نئے کنکشن · اس مہینے',
    dash_card_velocity: 'وصولی کی رفتار اور پیش گوئی',
    dash_card_total_coll: 'کل وصولی',
    dash_card_credit: 'غیر استعمال شدہ پیشگی کریڈٹ',
    dash_card_prev_coll: 'پچھلے مہینے کی وصولی',
    dash_card_exp_profit: 'متوقع ماہانہ پیکیج منافع',
    dash_card_prov_cost: 'متوقع ماہانہ فراہم کنندہ لاگت',
    dash_velocity_aria: 'بل شدہ رقم کی وصولی کی شرح',
    dash_target_title: 'ماہانہ وصولی بمقابلہ ہدف',
    dash_target_sub: 'ہدف کی تکمیل، روزانہ رفتار اور ماہ کے آخر کی پیش گوئی',
    dash_btn_target: 'ہدف مقرر / تبدیل کریں',
    dash_target_gauge_aria: 'ماہانہ وصولی بمقابلہ ہدف گیج',
    dash_worklists_title: 'منقطعی اور بحالی کی فہرستیں',
    dash_worklists_sub: 'فیلڈ اقدامات: زائد المیعاد معطلی اور ادا شدہ بحالی',
    dash_btn_worklists: 'فہرستیں کھولیں',
    dash_worklists_disc: 'منقطع کرنے ہیں',
    dash_worklists_rec: 'بحال کرنے ہیں',
    dash_worklists_ready: 'واجبات صاف · تیار',
    dash_charts_collapse: '📊 کارکردگی اور وصولی تجزیہ',
    dash_charts_badge: 'چارٹ',
    dash_charts_heading: 'کارکردگی اور وصولی تجزیہ',
    dash_prov_eyebrow: 'بار بار ہونے والا تخمینہ',
    dash_prov_heading: 'ISP کے حساب سے ماہانہ فراہم کنندہ لاگت (PKR)',
    dash_prov_explainer: 'صرف ہر فعال پروفائل کی محفوظ شدہ ماہانہ خرید لاگت استعمال ہوتی ہے۔ نامکمل لاگتیں شامل نہیں ہوتیں؛ فراہم کنندہ کے نام کبھی اندازے سے نہیں لکھے جاتے۔',
    dash_prov_empty: 'فراہم کنندہ لاگت کی کوئی اندراج ترتیب نہیں دی گئی۔',
    dash_owner_eyebrow: 'صرف مقامی · صرف پڑھنے والے جوابات',
    dash_owner_heading: 'مالک کمانڈ سینٹر',
    dash_owner_note: 'محفوظ شدہ بلوں، رسیدوں، گاہکوں اور اخراجات کے بارے میں پوچھیں۔ سوال پوچھنے سے کچھ تبدیل نہیں ہوتا۔',
    dash_owner_badge: 'آف لائن کام کرتا ہے',
    dash_owner_input_label: 'انگریزی، رومن اردو یا اردو میں پوچھیں',
    dash_owner_placeholder: 'اکتوبر کی وصولی؟ · علی کا بقایا؟ · آج کی وصولی؟',
    dash_owner_voice_btn: 'آواز · صرف ڈیوائس پر',
    dash_owner_ask: 'پوچھیں',
    dash_owner_voice_label: 'آواز کی زبان',
    dash_owner_voice_note: 'آواز صرف اس وقت شروع ہوتی ہے جب یہ براؤزر تصدیق کرے کہ مقامی اسپیچ ماڈل نصب ہے۔ رومن اردو میں لکھے گئے احکامات بدستور دستیاب رہتے ہیں۔',
    dash_overhead_due: 'اپ اسٹریم بینڈوتھ بل {month} کے لیے ابھی ادا نہیں ہوا — مہینہ ختم ہونے سے پہلے درج کریں تاکہ منافع اور شراکت داروں کے حصے درست رہیں۔',
    dash_overhead_btn: 'اوورہیڈ درج کریں',
    dash_shop_empty: 'دکانوں سے کوئی وصولی نہیں',
    dash_shop_empty_period: 'دکانوں پر غیر تصفیہ شدہ نقد رقم',
    dash_shop_sing: '{count} دکان',
    dash_shop_plur: '{count} دکانیں',
    dash_shop_receipt_sing: '{count} زیر التوا رسید',
    dash_shop_receipt_plur: '{count} زیر التوا رسیدیں',
    dash_shop_detail: '{collected} اس مہینے · آخری حوالگی {date}',
    dash_shop_never: 'کبھی نہیں',
    dash_cycle_empty: 'ابھی کوئی سائیکل نہیں چلا',
    dash_cycle_cycled: '{month} سائیکل مکمل',
    dash_cycle_period_empty: 'بقایا اور پیشگی کے ساتھ ماہانہ سائیکل چلائیں',
    dash_cycle_bills: '{count} بل · {amount} متوقع خالص وصولی',
    dash_cycle_billed: '{amount} بل شدہ',
    dash_cycle_arrears: '{amount} بقایا منتقل شدہ',
    dash_complaint_empty: 'کوئی شکایت نہیں',
    dash_complaint_open: '{open} کھلی · {inProgress} زیر عمل',
    dash_complaint_period_empty: 'کھلے نقص اور حل شدہ ڈاؤن ٹائم',
    dash_complaint_period: '{resolved} حل شدہ · {count} اس مہینے · {hours} گھنٹے ڈاؤن ٹائم',
    dash_detail_open_now: 'ابھی کھلی ہیں',
    dash_detail_progress_resolved: '{inProgress} زیر عمل · {resolved} حل شدہ',
    dash_ticket_empty: 'کوئی فیلڈ ٹکٹ نہیں',
    dash_ticket_period_empty: 'لائن مین ورک لسٹ اور سامان کا استعمال',
    dash_ticket_period: '{resolved} حل شدہ · PKR {charges} زیر التوا ٹکٹ چارجز',
    dash_downtime_empty: 'کوئی ڈاؤن ٹائم نہیں',
    dash_downtime_value: '{hours} گھنٹے ڈاؤن ٹائم',
    dash_downtime_period_empty: 'فی گاہک اور نیٹ ورک بندش کے گھنٹے',
    dash_downtime_period: '{count} شکایات · {customers} گاہک متاثر',
    dash_downtime_top: 'سب سے زیادہ متاثر گاہک',
    dash_downtime_detail: '{count} زون گیر نقص · {hours} گھنٹے',
    dash_splitter_empty: 'کوئی اسپلٹر باکس نہیں',
    dash_splitter_box_sing: '{count} باکس',
    dash_splitter_box_plur: '{count} باکسز',
    dash_splitter_ports: '{count} پورٹس استعمال شدہ',
    dash_splitter_period_empty: 'اسپلٹر باکس پورٹ نقشہ اور RX سگنل کی صحت',
    dash_splitter_spare_sing: '{count} خالی پورٹ',
    dash_splitter_spare_plur: '{count} خالی پورٹس',
    dash_splitter_weak_sing: '{count} کمزور سگنل',
    dash_splitter_weak_plur: '{count} کمزور سگنلز',
    dash_splitter_no_weak: 'کوئی کمزور سگنل نہیں',
    dash_splitter_weakest: 'کمزور ترین سگنل',
    dash_splitter_port: 'پورٹ {port}',
    dash_report_period_empty: '4 حصوں والی ماہانہ رپورٹ: خلاصہ، گاہک، وجوہات، مکمل لاگ',
    dash_report_value: '{count} شکایات · {hours} گھنٹے خالص بندش',
    dash_report_period: '{resolved} حل شدہ · {pending} زیر التوا · {hours} گھنٹے فائبر کٹ',
    dash_report_complaints: '{name} · {count} شکایات',
    dash_roz_closed: 'بند · {amount}',
    dash_roz_expected: '{amount} متوقع',
    dash_roz_farq: 'فرق {amount}',
    dash_roz_cash: 'نقد آمد {amount} · چھوٹے اخراجات {out}',
    dash_roz_opening: 'افتتاحی رقم',
    dash_roz_detail: '{cash} نقد ادائیگیاں · {handovers} دکان حوالگیاں',
    dash_inv_empty: 'کوئی اسٹاک درج نہیں',
    dash_inv_low_sing: '{count} کم اسٹاک آئٹم',
    dash_inv_low_plur: '{count} کم اسٹاک آئٹمز',
    dash_inv_period_empty: 'فائبر، روٹرز، کنورٹرز اور فیلڈ اسٹاک',
    dash_inv_move_sing: '{count} حرکت درج',
    dash_inv_move_plur: '{count} حرکتیں درج',
    dash_inv_fiber_left: 'باقی فائبر',
    dash_outage_empty: 'کوئی فیڈر لنک نہیں',
    dash_outage_linked: '{count} فیڈر سے منسلک',
    dash_outage_period_empty: 'بندش کا سراغ لگانے کے لیے گاہکوں کو فیڈرز سے جوڑیں',
    dash_outage_chain: 'طویل ترین سلسلہ: {count} نیچے والے متاثر ہو سکتے ہیں',
    dash_outage_chain_label: 'طویل ترین سلسلہ',
    dash_outage_downstream: '{name} · {count} نیچے والے',
    dash_saad_empty: 'ابھی کوئی وزٹ نہیں',
    dash_saad_visit_sing: '{count} وزٹ',
    dash_saad_visit_plur: '{count} وزٹس',
    dash_saad_day_sing: '{count} دن',
    dash_saad_day_plur: '{count} دن',
    dash_saad_period_empty: 'سعد فیلڈ وزٹ، گھنٹے اور ادائیگیاں',
    dash_saad_period: '{hours} گھنٹے کام · {amount} PKR ادا شدہ',
    dash_detail_latest: 'تازہ ترین',
    dash_install_empty: 'ابھی کوئی درخواست نہیں',
    dash_install_req_sing: '{count} درخواست',
    dash_install_req_plur: '{count} درخواستیں',
    dash_install_installed: '{count} نصب شدہ',
    dash_install_period_empty: 'نئے کنکشن کی درخواستیں اور انسٹالیشن میں تاخیر',
    dash_install_period: '{pending} زیر التوا · {days} کل تاخیر کے دن',
    dash_pending_empty: 'کچھ زیر التوا نہیں',
    dash_pending_due: '{count} اب واجب',
    dash_pending_count: '{count} زیر التوا',
    dash_pending_nearest: 'قریب ترین: {label}',
    dash_pending_period_empty: 'مالک کے نوٹس اور یاد دہانیاں',
    dash_pending_due_label: '⚠️ واجب',
    dash_pole_empty: 'کوئی پول نقشے میں نہیں',
    dash_pole_map_sing: '{count} پول نقشے میں',
    dash_pole_map_plur: '{count} پول نقشے میں',
    dash_pole_period: '{total} گاہک · اسٹریٹ پول، نشانی اور ڈراپ وائر ڈائریکٹری',
    dash_pole_label: 'نقشے میں',
    dash_pole_detail: '{total} میں سے {mapped} گاہک',
    dash_group_empty: 'ابھی کوئی گروپ نہیں',
    dash_group_period_empty: 'خاندان / مالک مکان گروپ',
    dash_group_sing: '{count} گروپ',
    dash_group_plur: '{count} گروپس',
    dash_group_dues: '{count} واجبات کے ساتھ',
    dash_group_collectible: 'قابل وصول کل رقم',
    dash_recovery_period_empty: 'منقطع گھروں میں ISP کا ہارڈویئر',
    dash_recovery_cust_sing: '{count} گاہک',
    dash_recovery_cust_plur: '{count} گاہک',
    dash_recovery_item_sing: '{count} آئٹم',
    dash_recovery_item_plur: '{count} آئٹمز',
    dash_recovery_period: 'جیسے ہی آئٹمز واپس آئیں، بازیاب شدہ نشان زد کریں',
    dash_recovery_first: 'پہلا زیر التوا',
    dash_khata_empty: 'کوئی سرگرمی نہیں',
    dash_khata_profit: '{amount} خالص منافع',
    dash_khata_period: '{month} · وصول شدہ {collected} · بقایا {arrears}',
    dash_khata_shares: 'حصے',
    dash_khata_partners: 'ناصر / عاقب',
    dash_khata_detail: '{complaints} شکایات · {hours} گھنٹے آف لائن',
    dash_wallet_empty: 'کوئی ڈیجیٹل ادائیگی نہیں',
    dash_wallet_period_empty: 'ایزی پیسہ · جیز کیش · نیا پے · بینک ٹرانسفر',
    dash_wallet_pending: '{count} تصدیق زیر التوا',
    dash_wallet_dup_sing: '{count} دوہری TID',
    dash_wallet_dup_plur: '{count} دوہری TIDs',
    dash_wallet_pay_sing: '{count} ادائیگی',
    dash_wallet_pay_plur: '{count} ادائیگیاں',
    dash_wallet_verified: '{count} تصدیق شدہ',
    dash_service_active_aria: 'فعال {count} — دستی سروس حالت کے حساب سے فلٹر کریں ({count} غیر آرکائیو شدہ)',
    dash_service_offline_aria: 'آف لائن {count} — دستی سروس حالت کے حساب سے فلٹر کریں ({count} غیر آرکائیو شدہ)',
    dash_service_notset_aria: 'منتخب نہیں {count} — دستی سروس حالت کے حساب سے فلٹر کریں ({count} غیر آرکائیو شدہ)',
    dash_service_announce: 'دستی سروس گنتی، آرکائیو شدہ پروفائلز کے بغیر: فعال {active} · آف لائن {offline} · منتخب نہیں {notset}',
    dash_no_payments: 'کوئی ادائیگی درج نہیں',
    dash_no_bills: 'کوئی بل درج نہیں',
    dash_not_set: 'طے نہیں',
    dash_no_entries: 'کوئی اندراج نہیں',
    dash_no_activity: 'کوئی درج شدہ سرگرمی نہیں',
    dash_no_credit: 'کوئی کریڈٹ اندراج نہیں',
    dash_expenses_period: 'اصل تاریخ والی اخراجات · {month}',
    dash_profit_period: '{collection} اصل رسیدیں − {expenses} درج شدہ اخراجات',
    dash_coll_period: 'اصل درج شدہ ادائیگیاں · آخری {months} محفوظ بلنگ مہینے',
    dash_coll_period_empty: 'محفوظ تاریخ میں کوئی اصل ادائیگی درج نہیں',
    dash_due_period: 'معلوم بقایا بل · {months} مہینے کی محفوظ تاریخ',
    dash_due_period_empty: 'محفوظ تاریخ میں کوئی بل درج نہیں ہوا',
    dash_today_period: 'آج کی تاریخ والی اصل ادائیگیاں · {date}',
    dash_prev_period: '{month} میں اصل ادائیگی کی تاریخیں',
    dash_current_due_period: 'رواں بلنگ مہینہ · {month}',
    dash_current_due_suffix: ' · کوئی بل درج نہیں',
    dash_margin_note: 'فروخت رقم − فراہم کنندہ لاگت · متوقع مارجن، وصول شدہ نقد منافع نہیں',
    dash_customer_period: '{archived} آرکائیو شدہ · {total} غیر آرکائیو شدہ پروفائلز؛ سروس حالت دستی ہے',
    dash_provcost_period: 'متوقع بار بار ماہانہ لاگت · نقد ادا شدہ نہیں',
    dash_provcost_empty: 'فراہم کنندہ لاگت کی کوئی اندراج نہیں · نقد ادا شدہ نہیں',
    dash_provcost_cost_sing: '{count} لاگت درج',
    dash_provcost_cost_plur: '{count} لاگتیں درج',
    dash_provcost_missing: '{count} نامکمل',
    dash_excluded_default: 'واجبات ہر محفوظ مہینے کے بل کی تصویر رسیدوں اور آگے منتقل شدہ کریڈٹ کے بعد استعمال کرتے ہیں؛ کریڈٹ نئی نقد رقم نہیں ہے۔',
    dash_note_selling_sing: 'فروخت رقم {count} گاہک کے لیے طے نہیں؛ قیمت درج ہونے تک کوئی ماہانہ بل نہیں بنتا۔',
    dash_note_selling_plur: 'فروخت رقم {count} گاہکوں کے لیے طے نہیں؛ قیمت درج ہونے تک کوئی ماہانہ بل نہیں بنتا۔',
    dash_note_unpriced_sing: '{count} زیر التوا بل بغیر درج شدہ رقم کے واجب مجموعوں سے خارج ہیں۔',
    dash_note_unpriced_plur: '{count} زیر التوا بل بغیر درج شدہ رقم کے واجب مجموعوں سے خارج ہیں۔',
    dash_note_profit_sing: 'منافع {count} پروفائل کے لیے طے نہیں جس میں فروخت رقم یا فراہم کنندہ لاگت نہیں؛ متوقع پیکیج منافع سے خارج۔',
    dash_note_profit_plur: 'منافع {count} پروفائلز کے لیے طے نہیں جن میں فروخت رقم یا فراہم کنندہ لاگت نہیں؛ متوقع پیکیج منافع سے خارج۔',
    dash_note_provcost_sing: 'فراہم کنندہ لاگت {count} فعال پروفائل کے لیے طے نہیں؛ متوقع ماہانہ فراہم کنندہ لاگت سے خارج۔',
    dash_note_provcost_plur: 'فراہم کنندہ لاگت {count} فعال پروفائلز کے لیے طے نہیں؛ متوقع ماہانہ فراہم کنندہ لاگت سے خارج۔',
    dash_kpi_active_period: '{offline} آف لائن · {notset} منتخب نہیں',
    dash_billstatus_empty: 'رواں مہینے کے لیے کوئی بل درج نہیں',
    dash_billstatus_value: '{paid} ادا شدہ · {unpaid} غیر ادا شدہ',
    dash_billstatus_period: '{partial} جزوی · {total} کل بل {month} میں',
    dash_billed_rate: 'بل شدہ رقم کی وصولی کی شرح {rate}%',
    dash_billed_period: 'قیمت والی تصاویر · {month}',
    dash_monthcoll_sing: '{count} رسید {month} میں',
    dash_monthcoll_plur: '{count} رسیدیں {month} میں',
    dash_newconn_period: '{month} میں درج شدہ',
    dash_velocity_day: '{amount} / دن',
    dash_velocity_proj: 'پیش گوئی: {amount} ({rate}% بل شدہ) · {days} دن باقی',
    dash_velocity_days: 'دن {day} از {daysInMonth} · {days} دن باقی',
    dash_kpi_rate: '{rate}% وصول شدہ',
    dash_kpi_rate_zero: '0% وصول شدہ',
    dash_defaulters_sing: '{count} گاہک',
    dash_defaulters_plur: '{count} گاہک',
    dash_worklist_dues: '{amount} واجبات (> {days} دن)',
    dash_today_live_suffix: 'براہ راست بندش رجسٹر اور وصولیاں',
    dash_today_cash_digital: 'نقد: {cash} · ڈیجیٹل: {digital}',
    dash_today_billed: '{collected} / {billed} بل شدہ',
    dash_today_dues_count: '{count} کھاتے واجبات کے ساتھ',
    dash_today_no_overdue: '✅ کوئی بقایا کھاتہ نہیں — تمام فعال گاہک صاف ہیں!',
    dash_today_wa_title: 'واٹس ایپ یاد دہانی بھیجیں',
    dash_today_wa_link_aria: '{name} کو واٹس ایپ بھیجیں',
    dash_today_collect_title: 'ادائیگی وصول کریں',
    dash_today_collect_aria: '{name} سے وصول کریں',
    dash_today_collect_text: 'وصول کریں',
    dash_closing_target: 'ہدف: {target}/دن ({pct}%) · خالص نقد: {cash}',
    dash_closing_target_alt: 'ہدف: {target} / دن · {pct}% تکمیل',
    dash_closing_status_no: 'آج کوئی سرگرمی نہیں',
    dash_closing_status_met: 'ہدف مکمل (100%+)',
    dash_closing_status_track: 'راہ پر',
    dash_closing_status_below: 'ہدف سے کم',
    dash_closing_copied: 'روزانہ بندش پرچی کلپ بورڈ میں نقل ہو گئی!',
    dash_closing_ready: 'روزانہ بندش خلاصہ تیار ہے۔',
    dash_chart_03_title: 'آمدنی اور وصولیوں کا رجحان',
    dash_chart_04_title: 'رواں مہینے کے بل کی تصفیہ',
    dash_chart_05_title: 'علاقے کے حساب سے بقایا واجبات',
    dash_chart_06_title: 'پیکیج درجوں کی تقسیم',
    dash_chart_07_title: 'گاہک صحت اور نادہندگی میٹرکس',
    dash_chart_08_title: 'ادائیگی تصفیہ چینلز',
    dash_chart_09_title: 'گاہک برقرار رکھنا اور چرن رسک',
    dash_chart_10_title: 'جغرافیائی وصولی ہیٹ میپ',
    dash_chart_11_title: 'موسمی کیش فلو اور کثیر سالہ رفتار',
    dash_chart_12_title: 'پیکیج مارجن اور ہول سیل ٹرانزٹ',
    dash_chart_13_title: 'گاہک لائف ٹائم ویلیو (LTV) اور کوہورٹس',
    dash_chart_14_title: 'نیٹ ورک بندش اور واقعہ میٹرکس',
    dash_chart_15_title: 'آئندہ کیش فلو اور چرن پیش گوئیاں',
    dash_chart_16_title: 'اپ اسٹریم ISP ٹرانزٹ اور فیل اوور',
    dash_chart_17_title: 'صارف حصول ROI اور واپسی',
    dash_chart_18_title: 'چوٹی ٹریفک اور بینڈوتھ شیپنگ',
    dash_chart_19_title: 'فائبر تقسیم حب اور اسپلٹر میٹرکس',
    dash_chart_20_title: 'نادہندگی وصولی پائپ لائن اور اقدامات کی رفتار',
    dash_chart_21_title: 'CPE اور ONU اثاثہ جات کا لائف سائیکل ٹریکر',
    dash_chart_22_title: 'بجلی کی بندش اور OLT بیٹری کی صحت',
    dash_chart_23_title: 'علاقہ روٹ کثافت اور کلیکٹر رفتار',
    dash_chart_24_title: 'OTDR فائبر فالٹ لوکیٹر اور بریک تخمینہ',
    dash_chart_25_title: 'سولر ہائبرڈ انورٹر اور گرڈ لوڈ شیڈنگ',
    dash_chart_26_title: 'فضائی فائبر پول تناؤ اور کیٹینری جھول',
    dash_chart_27_title: 'مائیکروویو بیک ہال بارش دھندلاہٹ اور لنک بجٹ',
    dash_chart_28_title: 'فضائی فائبر اسپلائس بندش اور مائیکرو بینڈ نقصان',
    dash_chart_29_title: 'زیر زمین ڈکٹ جیٹنگ اور کیبل رگڑ',
    dash_chart_30_title: 'OLT PON پورٹ DBA اور تاخیر قطاریں',
    dash_chart_31_title: 'فیوژن اسپلائسر آرک گھساؤ اور کلیو زاویہ',
    dash_chart_32_title: 'کور BGP پیئرنگ اور روٹ فلیپ ڈیمپنگ',
    dash_chart_33_title: 'ڈاؤن اسٹریم IPTV ملٹی کاسٹ اور زاپنگ',
    dash_chart_34_title: 'ایج DNS ریزولورز اور DNSSEC میٹرکس',
    dash_chart_35_title: 'DWDM آپٹیکل چینلز اور OSNR بجٹ',
    dash_chart_36_title: 'آپٹیکل سپروائزری چینل (OSC) اور لوپ بیک میٹرکس',
    dash_chart_37_title: 'میٹرو ایتھرنیٹ QinQ اور LACP ٹرنک سیچوریشن',
    dash_chart_38_title: 'کیریئر SyncE اور IEEE 1588v2 PTP کلاک میٹرکس',
    dash_chart_39_title: 'ROADM فلیکس گرڈ WSS آپٹیکل ری روٹنگ',
    dash_chart_40_title: 'SFP مائیکرو OTDR ٹرانسیور ریفلیکٹومیٹری',
    dash_chart_41_title: 'MC-LAG ڈوئل چیسس فالتو میٹرکس',
    dash_chart_42_title: 'BGP فلو اسپیک DDoS تخفیف میٹرکس',
    dash_chart_43_title: 'آپٹیکل فائبر رامن ایمپلیفائر (FRA) میٹرکس',
    dash_chart_44_title: 'کیریئر سیگمنٹ روٹنگ (SR-MPLS / SRv6) میٹرکس',
    dash_chart_45_title: 'DWDM پولرائزیشن موڈ ڈسپریشن (PMD) میٹرکس',
    dash_chart_46_title: 'MP-BGP EVPN / VXLAN نیٹ ورک ورچوئلائزیشن اوورلے میٹرکس',
    dash_chart_47_title: 'آپٹیکل فائبر نان لینیئر کیر اثرات اور تھریشولڈ میٹرکس',
    dash_chart_48_title: 'کور MPLS ٹریفک انجینئرنگ اور FRR ہیڈ روم میٹرکس',
    dash_chart_49_title: 'کیریئر ایتھرنیٹ E-Line / E-LAN بینڈوتھ پروفائلز',
    dash_chart_50_title: 'میٹرو ایتھرنیٹ رنگ پروٹیکشن (ITU-T G.8032 ERPS)',
    dash_chart_51_title: 'کیریئر ایتھرنیٹ OAM اور PM (ITU-T Y.1731 / 802.1ag)',
    dash_chart_52_title: 'کیریئر MPLS سیوڈو وائر (VPWS / EoMPLS) میٹرکس',
    dash_chart_53_title: 'کیریئر BFD (RFC 5880 / 5881 / 7130) فالٹ شناخت میٹرکس',
    dash_chart_54_title: 'کیریئر MPLS VPLS (RFC 4761 / 4762) ملٹی پوائنٹ میٹرکس',
    dash_chart_55_title: 'برلوئن سینسنگ (BOTDA / ITU-T G.650.2) DTSS میٹرکس',
    dash_chart_56_title: 'کیریئر CGNAT (RFC 6598 / 7422) پورٹ بلاک مختص میٹرکس',
    dash_chart_57_title: 'آپٹیکل OLT چیسس (ITU-T G.984 / G.9807.1) صلاحیت میٹرکس',
    dash_chart_58_title: 'کیریئر SRv6 (RFC 8986 / 8754) نیٹ ورک پروگرامنگ میٹرکس',
    dash_chart_59_title: 'کیریئر فلیکس الگو (RFC 9350 / 9351) ملٹی پلین میٹرکس',
    dash_chart_60_title: 'آپٹیکل ماڈیولیشن اور کانسٹیلیشن EVM (ITU-T G.698.2) میٹرکس',
    dash_chart_61_title: 'آپٹیکل ٹرانسپورٹ نیٹ ورک (OTN - ITU-T G.709) میٹرکس',
    dash_chart_62_title: 'کیریئر MPLS-TP (ITU-T G.8113.1) 1:1 تحفظ میٹرکس',
    dash_chart_63_title: 'کیریئر BGP/MPLS IP VPN (L3VPN - RFC 4364) ملٹی VRF میٹرکس',
    dash_chart_64_title: 'کیریئر DWDM کیسکیڈڈ EDFA اور DGE مساوات میٹرکس',
    dash_chart_65_title: 'کیریئر PTP IEEE 1588v2 ٹیلی کام باؤنڈری کلاک (T-BC) میٹرکس',
    dash_chart_66_title: 'کیریئر BGP روٹ اوریجن توثیق (ROV / RFC 6811) اور فلیپ ڈیمپنگ میٹرکس',
    dash_chart_67_title: 'کیریئر کوہیرنٹ آپٹیکل پولرائزیشن موڈ حالت اور DSP ایکویلائزر میٹرکس',
    dash_chart_68_title: 'کیریئر RoCEv2 لاس لیس فیبرک، پرائرٹی فلو کنٹرول (PFC) اور ECN میٹرکس',
    dash_chart_69_title: 'کیریئر آپٹیکل لائن پروٹیکشن (OLP 1+1) اور ہٹ لیس سوئچ میٹرکس',
    dash_chart_03_sub: 'ہر مہینے کی بل کی تصویر کی آمدنی بمقابلہ اس مہینے کی اصل رسیدیں',
    dash_chart_04_sub: 'ادا شدہ، جزوی اور غیر ادا شدہ بلوں کی تقسیم',
    dash_chart_05_sub: 'گاہک کے مقام کے حساب سے غیر وصول شدہ بقایا',
    dash_chart_06_sub: 'درجے کے حساب سے صارفین اور ماہانہ آمدنی',
    dash_chart_07_sub: 'کھاتے کی حالت، واچ لسٹ اور زائد المیعاد رسک حصے',
    dash_chart_08_sub: 'نقد بمقابلہ ڈیجیٹل والیٹ حجم اور لین دین کی تقسیم',
    dash_chart_09_sub: 'آف لائن مدت اور مسلسل واجبات پر مبنی پیش گوئی رسک گیج',
    dash_chart_10_sub: 'آپریشنل زون کے حساب سے وصولی کی کارکردگی اور بحالی کی شرح',
    dash_chart_11_sub: 'جنوری تا دسمبر وصولی کے رجحانات اور سال بہ سال رفتار',
    dash_chart_12_sub: 'درجے کے حساب سے اپ اسٹریم بینڈوتھ لاگت بمقابلہ مجموعی منافع',
    dash_chart_13_sub: 'مدت کے حساب سے تاریخی وصول شدہ آمدنی اور برقرار رکھنے کی پیش رفت',
    dash_chart_14_sub: 'علاقہ شکایت کی تعدد، MTTR بحالی کی رفتار اور فعال ڈاؤن ٹائم',
    dash_chart_15_sub: '6 مہینے کی آئندہ بار بار آمدنی کے منظرنامے اور وصولی کے منحنی خطوط',
    dash_chart_16_sub: 'ہول سیل لنک تاخیر، بینڈوتھ صلاحیت اور ملٹی ہوم روٹنگ',
    dash_chart_17_sub: 'چینل CAC معاشیات، واپسی کی رفتار اور مارکیٹنگ ROI',
    dash_chart_18_sub: '24 گھنٹے استعمال، تنازعہ تناسب اور ترقی کی پیش گوئی',
    dash_chart_19_sub: 'آپٹیکل پورٹ مختص، تاریک فائبر گنجائش اور کمی کی نگرانی',
    dash_chart_20_sub: 'عمر کے مراحل، وزنی بحالی کا امکان اور فیلڈ کلیکٹر رفتار',
    dash_fallback_unknown: 'نامعلوم',
    dash_fallback_unnamed: 'بے نام',
    dash_charts_eyebrow: 'بصری لیجر بصیرتیں',
    dash_charts_caption: 'مکمل طور پر مقامی آف لائن SVG چارٹ۔ براہ راست لیجر حسابات۔',
    dash_prov_title: '💼 ماہانہ فراہم کنندہ لاگت کی تفصیل',
    dash_btn_roznamcha: '📒 روزنامچہ',
    dash_btn_wallet: '💳 والیٹ لیجر',
    dash_closing_value: '{amount} ({count} لین دین)',

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
    // The accessible name must contain the button's visible label text
    // (axe label-content-name-mismatch, #229), so prefix it.
    const visibleLabel = activeLang === 'ur' ? 'English' : 'اردو';
    btn.setAttribute('aria-label', `${visibleLabel} — ${t('lang_aria_label', activeLang)}`);
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
  const aria = `${nextLabel} — ${t('lang_aria_label', active)}`;

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
