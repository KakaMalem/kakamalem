// ============================================================================
// NAV / LINK PRIMITIVES
// ============================================================================

export type NavItem = { label: string; href: string };
export type FooterColumn = { title: string; links: NavItem[] };

// ============================================================================
// HEADER CONFIG
// ============================================================================

export type HeaderStyle = "default" | "centered" | "minimal";

export type HeaderConfig = {
  enabled: boolean;
  headerStyle: HeaderStyle;
  headerDisplay: "logo_only" | "name_only" | "logo_and_name";
  logoUrl: string;
  faviconUrl: string;
  logoSize: "sm" | "md" | "lg";
  showSearchBar: boolean;
  showCategoriesBar: boolean;
  stickyHeader: boolean;
  colorScheme: "light" | "dark" | "primary" | "transparent" | "custom";
  backgroundColor: string;
  textColor: string;
  borderBottom: boolean;
  padding: "compact" | "normal" | "spacious";
  navItems: NavItem[];
};

export const defaultHeaderConfig: HeaderConfig = {
  enabled: true,
  headerStyle: "default",
  headerDisplay: "logo_and_name",
  logoUrl: "",
  faviconUrl: "",
  logoSize: "md",
  showSearchBar: true,
  showCategoriesBar: true,
  stickyHeader: false,
  colorScheme: "light",
  backgroundColor: "",
  textColor: "",
  borderBottom: true,
  padding: "normal",
  navItems: [],
};

// ============================================================================
// FOOTER CONFIG
// ============================================================================

export type FooterStyle = "standard" | "minimal" | "centered";

export type FooterConfig = {
  enabled: boolean;
  footerStyle: FooterStyle;
  showQuickLinks: boolean;
  showCategories: boolean;
  showContact: boolean;
  showSocialLinks: boolean;
  showNewsletter: boolean;
  colorScheme: "light" | "dark" | "primary" | "custom";
  backgroundColor: string;
  textColor: string;
  padding: "compact" | "normal" | "spacious";
  copyrightText: string;
  customColumns: FooterColumn[];
};

export const defaultFooterConfig: FooterConfig = {
  enabled: true,
  footerStyle: "standard",
  showQuickLinks: true,
  showCategories: true,
  showContact: true,
  showSocialLinks: true,
  showNewsletter: false,
  colorScheme: "light",
  backgroundColor: "",
  textColor: "",
  padding: "normal",
  copyrightText: "",
  customColumns: [],
};

// ============================================================================
// COMBINED LAYOUT CONFIG
// ============================================================================

export type LayoutConfig = {
  header: HeaderConfig;
  footer: FooterConfig;
};

export const defaultLayoutConfig: LayoutConfig = {
  header: defaultHeaderConfig,
  footer: defaultFooterConfig,
};
