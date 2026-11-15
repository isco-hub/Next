import styles from "./ui.module.css";

export interface StepperProps {
  steps: string[];
  current: number;
  label: string;
}

export const Stepper = ({ steps, current, label }: StepperProps) => (
  <ol className={styles.stepper} aria-label={label}>
    {steps.map((step, index) => {
      const number = index + 1;
      const state =
        number === current ? styles.stepActive : number < current ? styles.stepDone : "";
      return (
        <li
          key={step}
          className={`${styles.step} ${state}`}
          aria-current={number === current ? "step" : undefined}
        >
          <span className={styles.stepDot} aria-hidden="true">
            {number < current ? "\u2713" : number}
          </span>
          <span className={styles.stepLabel}>{step}</span>
          {index < steps.length - 1 ? (
            <span
              className={`${styles.stepLine} ${number < current ? styles.stepLineDone : ""}`}
              aria-hidden="true"
            />
          ) : null}
        </li>
      );
    })}
  </ol>
);
