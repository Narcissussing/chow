import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";

// Liste réordonnable au glisser (Cuisine, ingrédients de recette) ; onDeplacer(depuis, vers) en index.
export function ListeTriable({ ids, onDeplacer, children }) {
  const capteurs = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  function terminer({ active, over }) {
    if (!over || active.id === over.id) return;
    const depuis = ids.indexOf(active.id);
    const vers = ids.indexOf(over.id);
    if (depuis !== -1 && vers !== -1) onDeplacer(depuis, vers);
  }

  return (
    <DndContext sensors={capteurs} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis, restrictToParentElement]} onDragEnd={terminer}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

// Seule la poignée démarre le geste : le reste de la carte garde le défilement tactile et ses champs.
export function useTriable(id, ref) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });

  function refNoeud(el) {
    setNodeRef(el);
    if (typeof ref === "function") ref(el);
    else if (ref) ref.current = el;
  }

  const poignee = <button type="button" ref={setActivatorNodeRef} className="poignee-glisser" title="Glisser pour déplacer" aria-label="Glisser pour déplacer" {...attributes} {...listeners}></button>;

  // Propriété "translate", pas "transform" : l'animation popIn (fill "both") des lignes .entree garderait
  // son transform final et figerait la ligne sous le doigt.
  return {
    refNoeud,
    style: { translate: transform ? `${Math.round(transform.x)}px ${Math.round(transform.y)}px` : undefined, transition: transition?.replace(/\btransform\b/g, "translate") },
    classe: isDragging ? " en-glisse" : "",
    poignee,
  };
}
