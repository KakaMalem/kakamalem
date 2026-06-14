"use client";

import { cn } from "@/lib/utils";

interface WhatsAppButtonProps {
  phoneNumber: string;
  className?: string;
}

// WhatsApp icon
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

export function WhatsAppButton({
  phoneNumber,
  className,
}: WhatsAppButtonProps) {
  // Strip non-numeric characters from phone number
  const cleanNumber = phoneNumber.replace(/[^0-9]/g, "");

  if (!cleanNumber) {
    return null;
  }

  return (
    <a
      href={`https://wa.me/${cleanNumber}`}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        // Lifted above the mobile bottom tab bar; normal position on desktop
        "fixed bottom-20 right-4 z-40 md:bottom-6 md:right-6 md:z-50",
        "flex items-center justify-center",
        "size-14 rounded-full",
        "bg-[#25D366] text-white shadow-lg",
        "transition-all duration-200",
        "hover:scale-110 hover:shadow-xl",
        "focus:outline-none focus:ring-2 focus:ring-[#25D366] focus:ring-offset-2",
        "animate-in fade-in slide-in-from-bottom-4 duration-500",
        className
      )}
      aria-label="Contact us on WhatsApp"
    >
      <WhatsAppIcon className="size-7" />
    </a>
  );
}
