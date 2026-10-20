import styles from "./SegmentedControl.module.css";

type SegmentOption<TValue extends string> = { value: TValue; label: string };

type SegmentedControlProps<TValue extends string> = {
  label: string;
  options: SegmentOption<TValue>[];
  value: TValue;
  onChange: (value: TValue) => void;
  /** Stretches the control to its container and splits the width evenly between the options. */
  fullWidth?: boolean;
};

export function SegmentedControl<TValue extends string>({
  label,
  options,
  value,
  onChange,
  fullWidth = false,
}: SegmentedControlProps<TValue>) {
  return (
    <div
      className={`${styles.control} ${fullWidth ? styles.fullWidth : ""}`}
      role="radiogroup"
      aria-label={label}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          className={`${styles.option} ${option.value === value ? styles.selected : ""}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
