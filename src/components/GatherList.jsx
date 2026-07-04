import { formatGrams } from "../lib/format";

export default function GatherList({ items }) {
  return (
    <ul className="gather-list">
      {items.map((item) => (
        <li key={item.name} className="gather-list__item">
          <span className="gather-list__name">{item.name}</span>
          <span className="gather-list__qty">{formatGrams(item.grams)}</span>
        </li>
      ))}
    </ul>
  );
}
