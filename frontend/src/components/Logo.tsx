interface Props {
  size?: number;
  className?: string;
}

/** Квадратният знак на ДОКОГА? (от public/dokoga-logo.svg). */
export default function Logo({ size = 32, className = "" }: Props) {
  return (
    <img
      src="/dokoga-logo.svg"
      width={size}
      height={size}
      alt="ДОКОГА?"
      className={`logo-mark ${className}`.trim()}
      draggable={false}
    />
  );
}
