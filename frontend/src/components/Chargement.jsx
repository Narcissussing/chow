import "./Chargement.css";

export default function Chargement() {
  return (
    <main className="etat-chargement" aria-busy="true">
      <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path className="vapeur vapeur--1" d="M24 20c-3-3 3-5 0-8" />
        <path className="vapeur vapeur--2" d="M32 18c-3-3 3-5 0-8" />
        <path className="vapeur vapeur--3" d="M40 20c-3-3 3-5 0-8" />
        <g className="couvercle">
          <path d="M16 31a16 6 0 0 1 32 0" />
          <path d="M30 25h4" />
          <path d="M13 31h38" />
        </g>
        <path d="M15 35v8a9 9 0 0 0 9 9h16a9 9 0 0 0 9-9v-8" />
        <path d="M15 37H9M49 37h6" />
      </svg>
    </main>
  );
}
