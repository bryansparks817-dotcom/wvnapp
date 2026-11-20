// Shown when a prep item is finished: print its label now, or skip it.
// Skipping doesn't block anything; the label can still be printed later
// from the item's recipe screen.
export default function LabelPrompt({ name, count, onPrint, onSkip }) {
  return (
    <div className="pass pass__labelsheet" role="dialog" aria-modal="true" aria-label={`Label for ${name}`}>
      <div className="pass__labelcard">
        <span className="pass__countlabel">DONE · LABEL?</span>
        <h2 className="pass__labeltitle">{name}</h2>
        <p className="pass__hint">
          {count > 1 ? `${count} labels, one per container.` : "One label for the container."} Printing is optional.
        </p>
        <button type="button" className="pass__cta" onClick={onPrint}>PRINT LABEL</button>
        <button type="button" className="pass__ghostbtn" onClick={onSkip}>SKIP FOR NOW</button>
      </div>
    </div>
  );
}
