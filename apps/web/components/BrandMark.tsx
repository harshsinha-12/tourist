export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <img
      className="brand-mark"
      src="/brand/tourist-mark.png"
      alt=""
      width={size}
      height={size}
      draggable={false}
    />
  );
}
