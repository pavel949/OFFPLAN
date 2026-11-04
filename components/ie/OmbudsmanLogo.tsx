import Image from "next/image";

/**
 * Logo of the Moscow City Business Ombudsman, shown ONLY as the affiliation of the public representative
 * (Order No. 320-P), never as the platform's own mark. It is dark artwork, so it always sits on a white plate.
 */
export function OmbudsmanLogo({ height = 44, className = "" }: { height?: number; className?: string }) {
  const width = Math.round((height * 13579) / 5036);
  return (
    <span className={`ie-oplate ${className}`}>
      <Image
        src="/brand/ombudsman-moscow.svg"
        alt="Уполномоченный по защите прав предпринимателей в городе Москве"
        width={width}
        height={height}
        unoptimized
      />
    </span>
  );
}
