import type { RainfallPoint } from "@nextcrop/api-client";
import { useI18n } from "@nextcrop/i18n";
import styles from "./ui.module.css";

export interface RainfallChartProps {
  points: RainfallPoint[];
  actualTotal: number;
  normalTotal: number;
}

const WIDTH = 320;
const HEIGHT = 132;
const PADDING_TOP = 10;
const PADDING_BOTTOM = 22;

export const RainfallChart = ({
  points,
  actualTotal,
  normalTotal,
}: RainfallChartProps) => {
  const { t, formatDate, formatNumber } = useI18n();
  if (points.length === 0) return null;

  const plotHeight = HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const max = Math.max(
    1,
    ...points.map((point) => Math.max(point.actual_mm, point.normal_mm)),
  );
  const slot = WIDTH / points.length;
  const barWidth = Math.max(2, slot * 0.58);
  const y = (value: number) => PADDING_TOP + plotHeight - (value / max) * plotHeight;
  const xCenter = (index: number) => index * slot + slot / 2;
  const normalLine = points
    .map((point, index) => `${xCenter(index)},${y(point.normal_mm)}`)
    .join(" ");
  const first = points[0];
  const last = points[points.length - 1];
  const summary = t("climate.chartSummary", {
    actual: formatNumber(actualTotal, { maximumFractionDigits: 1 }),
    normal: formatNumber(normalTotal, { maximumFractionDigits: 1 }),
  });

  return (
    <figure className={styles.chart}>
      <div className={styles.chartWrap}>
        <svg
          className={styles.chartSvg}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label={t("climate.rainfallAria")}
        >
          <line
            className={styles.chartBaseline}
            x1={0}
            x2={WIDTH}
            y1={y(0)}
            y2={y(0)}
          />
          {points.map((point, index) => {
            const height = Math.max(0, y(0) - y(point.actual_mm));
            return (
              <rect
                key={point.date}
                className={styles.chartBars}
                x={xCenter(index) - barWidth / 2}
                y={y(point.actual_mm)}
                width={barWidth}
                height={height}
                rx={1.2}
              >
                <title>
                  {`${formatDate(point.date)}: ${formatNumber(point.actual_mm, {
                    maximumFractionDigits: 1,
                  })} mm`}
                </title>
              </rect>
            );
          })}
          <polyline className={styles.chartNormal} points={normalLine} />
          {first ? (
            <text x={2} y={HEIGHT - 4} fontSize={9} fill="currentColor">
              {formatDate(first.date, { day: "numeric", month: "short" })}
            </text>
          ) : null}
          {last ? (
            <text x={WIDTH - 2} y={HEIGHT - 4} fontSize={9} fill="currentColor" textAnchor="end">
              {formatDate(last.date, { day: "numeric", month: "short" })}
            </text>
          ) : null}
        </svg>
      </div>
      <div className={styles.chartLegend}>
        <span className={styles.legendItem}>
          <span className={styles.legendSwatch} aria-hidden="true" />
          {t("climate.actual")}
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendLine} aria-hidden="true" />
          {t("climate.normal")}
        </span>
      </div>
      <p className={styles.chartSummary}>{summary}</p>
      <details>
        <summary className={styles.chartSummary}>{t("climate.chartTable")}</summary>
        <div className={styles.chartTableWrap}>
          <table className={styles.chartTable}>
            <caption className={styles.srOnly}>{summary}</caption>
            <thead>
              <tr>
                <th scope="col">{t("climate.date")}</th>
                <th scope="col">{t("climate.rainActual")}</th>
                <th scope="col">{t("climate.rainNormal")}</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.date}>
                  <td>{formatDate(point.date)}</td>
                  <td>{formatNumber(point.actual_mm, { maximumFractionDigits: 1 })}</td>
                  <td>{formatNumber(point.normal_mm, { maximumFractionDigits: 1 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
};

