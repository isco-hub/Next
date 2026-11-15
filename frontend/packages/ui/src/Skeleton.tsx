import styles from "./ui.module.css";

export interface SkeletonProps {
  width?: string;
  height?: string;
  borderRadius?: string;
  className?: string;
  label?: string;
}

export const Skeleton = ({
  width = "100%",
  height = "1rem",
  borderRadius,
  className = "",
  label,
}: SkeletonProps) => (
  <span
    className={`${styles.skeleton} ${className}`}
    style={{ width, height, borderRadius }}
    aria-hidden={label ? undefined : true}
    aria-label={label}
    role={label ? "status" : undefined}
  />
);
