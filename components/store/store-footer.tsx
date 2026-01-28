import Link from "next/link";
import {
  Facebook,
  Instagram,
  Twitter,
  Youtube,
  Send,
  Mail,
  Phone,
} from "lucide-react";

import { Separator } from "@/components/ui/separator";
import { Logo } from "@/components/ui/logo";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import type {
  Tenant,
  Category,
  SocialLinks,
  PreferredContactMethod,
} from "@/lib/db/schema";

// TikTok icon (not in lucide-react)
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z" />
    </svg>
  );
}

// WhatsApp icon (not in lucide-react)
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M17.415 14.382c-.298-.149-1.759-.867-2.031-.967-.272-.099-.47-.148-.669.15-.198.296-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.521.149-.173.198-.297.298-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.981.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0011.992 0C5.438 0 .102 5.335.1 11.892a11.864 11.864 0 001.587 5.945L0 24l6.305-1.654a11.881 11.881 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413"
      />
    </svg>
  );
}

interface SocialLinkProps {
  href: string;
  label: string;
  children: React.ReactNode;
}

function SocialLink({ href, label, children }: SocialLinkProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
          aria-label={label}
        >
          {children}
        </a>
      </TooltipTrigger>
      <TooltipContent>
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  );
}

interface StoreFooterProps {
  store: Tenant;
  categories: Pick<Category, "id" | "name" | "slug">[];
  hideBranding?: boolean;
}

export function StoreFooter({
  store,
  categories,
  hideBranding,
}: StoreFooterProps) {
  const storeUrl = `/store/${store.slug}`;
  const socialLinks = store.socialLinks as SocialLinks | null;
  const currentYear = new Date().getFullYear();

  // Check if there are any social links
  const hasSocialLinks =
    socialLinks &&
    Object.values(socialLinks).some(
      (link) => typeof link === "string" && link.length > 0
    );

  const hasContactInfo = store.contactEmail || store.contactPhone;

  // WhatsApp settings
  const preferredContactMethod: PreferredContactMethod =
    socialLinks?.preferredContactMethod || "whatsapp";
  const whatsappNumber = socialLinks?.whatsapp?.replace(/[^0-9]/g, "") || "";
  const hasWhatsApp = !!whatsappNumber;

  // Helper to get the phone link href based on preferred method
  const getPhoneHref = () => {
    if (preferredContactMethod === "whatsapp" && hasWhatsApp) {
      return `https://wa.me/${whatsappNumber}`;
    }
    return `tel:${store.contactPhone}`;
  };

  // Helper to get phone link icon and label based on preferred method
  const getPhoneDisplay = () => {
    if (preferredContactMethod === "whatsapp" && hasWhatsApp) {
      return { Icon: WhatsAppIcon, label: "WhatsApp" };
    }
    return { Icon: Phone, label: "Phone" };
  };

  // Determine what to show in the footer based on headerDisplay setting
  const showLogo =
    store.headerDisplay === "logo_only" ||
    store.headerDisplay === "logo_and_name";
  const showName =
    store.headerDisplay === "name_only" ||
    store.headerDisplay === "logo_and_name";

  return (
    <TooltipProvider>
      <footer className="border-t bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 md:py-12 lg:px-8">
          <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-4">
            {/* Store Info */}
            <div className="space-y-4 sm:col-span-2 md:col-span-1">
              <Link
                href={storeUrl}
                className="inline-flex items-center gap-2.5 transition-opacity hover:opacity-80"
              >
                {showLogo && (
                  <Logo logoUrl={store.logoUrl} alt={store.name} size="lg" />
                )}
                {showName && (
                  <span className="text-lg font-semibold">{store.name}</span>
                )}
              </Link>
              {store.description && (
                <p className="text-sm leading-relaxed text-muted-foreground line-clamp-3">
                  {store.description}
                </p>
              )}

              {/* Social Links - shown in store info section on mobile/small screens */}
              {hasSocialLinks && (
                <div className="flex flex-wrap gap-2 pt-2 md:hidden">
                  {socialLinks?.facebook && (
                    <SocialLink href={socialLinks.facebook} label="Facebook">
                      <Facebook className="size-4" />
                    </SocialLink>
                  )}
                  {socialLinks?.instagram && (
                    <SocialLink href={socialLinks.instagram} label="Instagram">
                      <Instagram className="size-4" />
                    </SocialLink>
                  )}
                  {socialLinks?.twitter && (
                    <SocialLink href={socialLinks.twitter} label="Twitter / X">
                      <Twitter className="size-4" />
                    </SocialLink>
                  )}
                  {socialLinks?.youtube && (
                    <SocialLink href={socialLinks.youtube} label="YouTube">
                      <Youtube className="size-4" />
                    </SocialLink>
                  )}
                  {socialLinks?.tiktok && (
                    <SocialLink href={socialLinks.tiktok} label="TikTok">
                      <TikTokIcon className="size-4" />
                    </SocialLink>
                  )}
                  {socialLinks?.telegram && (
                    <SocialLink href={socialLinks.telegram} label="Telegram">
                      <Send className="size-4" />
                    </SocialLink>
                  )}
                  {socialLinks?.whatsapp && (
                    <SocialLink
                      href={`https://wa.me/${socialLinks.whatsapp.replace(
                        /[^0-9]/g,
                        ""
                      )}`}
                      label="WhatsApp"
                    >
                      <WhatsAppIcon className="size-4" />
                    </SocialLink>
                  )}
                </div>
              )}
            </div>

            {/* Quick Links */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider">
                Quick Links
              </h3>
              <nav className="flex flex-col gap-2.5">
                <Link
                  href={storeUrl}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  Home
                </Link>
                <Link
                  href={`${storeUrl}/products`}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  All Products
                </Link>
                <Link
                  href={`${storeUrl}/categories`}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  Categories
                </Link>
              </nav>
            </div>

            {/* Categories */}
            {categories.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider">
                  Categories
                </h3>
                <nav className="flex flex-col gap-2.5">
                  {categories.slice(0, 5).map((category) => (
                    <Link
                      key={category.id}
                      href={`${storeUrl}/category/${category.slug}`}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {category.name}
                    </Link>
                  ))}
                  {categories.length > 5 && (
                    <Link
                      href={`${storeUrl}/categories`}
                      className="text-sm font-medium text-primary transition-colors hover:text-primary/80"
                    >
                      View all ({categories.length})
                    </Link>
                  )}
                </nav>
              </div>
            )}

            {/* Contact & Social */}
            <div className="space-y-4">
              {hasContactInfo && (
                <>
                  <h3 className="text-sm font-semibold uppercase tracking-wider">
                    Contact Us
                  </h3>
                  <div className="flex flex-col gap-3">
                    {store.contactEmail && (
                      <a
                        href={`mailto:${store.contactEmail}`}
                        className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <Mail className="size-4 shrink-0" />
                        <span className="truncate">{store.contactEmail}</span>
                      </a>
                    )}
                    {store.contactPhone &&
                    preferredContactMethod === "both" &&
                    hasWhatsApp ? (
                      // Show both phone and WhatsApp
                      <div className="flex flex-col gap-2">
                        <a
                          href={`tel:${store.contactPhone}`}
                          className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                        >
                          <Phone className="size-4 shrink-0" />
                          <span>{store.contactPhone}</span>
                        </a>
                        <a
                          href={`https://wa.me/${whatsappNumber}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                        >
                          <WhatsAppIcon className="size-4 shrink-0" />
                          <span>WhatsApp</span>
                        </a>
                      </div>
                    ) : store.contactPhone ? (
                      // Show single preferred contact method
                      <a
                        href={getPhoneHref()}
                        target={
                          preferredContactMethod === "whatsapp" && hasWhatsApp
                            ? "_blank"
                            : undefined
                        }
                        rel={
                          preferredContactMethod === "whatsapp" && hasWhatsApp
                            ? "noopener noreferrer"
                            : undefined
                        }
                        className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {(() => {
                          const { Icon, label } = getPhoneDisplay();
                          return (
                            <>
                              <Icon className="size-4 shrink-0" />
                              <span>
                                {label === "WhatsApp"
                                  ? "WhatsApp"
                                  : store.contactPhone}
                              </span>
                            </>
                          );
                        })()}
                      </a>
                    ) : null}
                  </div>
                </>
              )}

              {/* Social Links - Tablet & Desktop */}
              {hasSocialLinks && (
                <div className="hidden space-y-3 md:block">
                  <h3 className="text-sm font-semibold uppercase tracking-wider">
                    Follow Us
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {socialLinks?.facebook && (
                      <SocialLink href={socialLinks.facebook} label="Facebook">
                        <Facebook className="size-4" />
                      </SocialLink>
                    )}
                    {socialLinks?.instagram && (
                      <SocialLink
                        href={socialLinks.instagram}
                        label="Instagram"
                      >
                        <Instagram className="size-4" />
                      </SocialLink>
                    )}
                    {socialLinks?.twitter && (
                      <SocialLink
                        href={socialLinks.twitter}
                        label="Twitter / X"
                      >
                        <Twitter className="size-4" />
                      </SocialLink>
                    )}
                    {socialLinks?.youtube && (
                      <SocialLink href={socialLinks.youtube} label="YouTube">
                        <Youtube className="size-4" />
                      </SocialLink>
                    )}
                    {socialLinks?.tiktok && (
                      <SocialLink href={socialLinks.tiktok} label="TikTok">
                        <TikTokIcon className="size-4" />
                      </SocialLink>
                    )}
                    {socialLinks?.telegram && (
                      <SocialLink href={socialLinks.telegram} label="Telegram">
                        <Send className="size-4" />
                      </SocialLink>
                    )}
                    {socialLinks?.whatsapp && (
                      <SocialLink
                        href={`https://wa.me/${socialLinks.whatsapp.replace(
                          /[^0-9]/g,
                          ""
                        )}`}
                        label="WhatsApp"
                      >
                        <WhatsAppIcon className="size-4" />
                      </SocialLink>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <Separator className="my-8" />

          {/* Bottom Bar */}
          <div className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
            <p className="text-sm text-muted-foreground">
              &copy; {currentYear} {store.name}. All rights reserved.
            </p>
            {!hideBranding && (
              <p className="text-sm text-muted-foreground">
                Powered by{" "}
                <Link
                  href="/"
                  className="font-medium text-foreground transition-colors hover:text-primary"
                >
                  Kaka Malem
                </Link>
              </p>
            )}
          </div>
        </div>
      </footer>
    </TooltipProvider>
  );
}
