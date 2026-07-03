import { formatQty } from "../lib/format";

export default function GatherList({ items }) {
  return (
    <ul className="gather-list">
      {items.map((item) => (
        <li key={`${item.name}|${item.unit}`} className="gather-list__item">
          <span className="gather-list__name">{item.name}</span>
          <span className="gather-list__qty">
            {formatQty(item.qty)} {item.unit}
          </span>
        </li>
      ))}
    </ul>
  );
}
