import L from "leaflet";
import { useEffect } from "react";
import { useMap } from "react-leaflet";

const CONTROL_SELECTOR = [
  "button",
  "input",
  "textarea",
  "select",
  "a",
].join(",");

function canScrollElement(element: Element, deltaY: number) {
  const style = window.getComputedStyle(element);
  const overflowY = style.overflowY;
  const scrollable = (overflowY === "auto" || overflowY === "scroll") && element.scrollHeight > element.clientHeight;

  if (!scrollable) return false;
  if (deltaY < 0) return element.scrollTop > 0;
  if (deltaY > 0) return element.scrollTop + element.clientHeight < element.scrollHeight;
  return false;
}

function shouldKeepWheelForUi(target: EventTarget | null, container: HTMLElement, deltaY: number) {
  if (!(target instanceof Element)) return false;
  if (target.closest(CONTROL_SELECTOR)) return true;

  for (let el: Element | null = target; el && el !== container; el = el.parentElement) {
    if (canScrollElement(el, deltaY)) return true;
  }

  return false;
}

export default function TrackpadPan() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();

    function onWheel(event: WheelEvent) {
      const rect = container.getBoundingClientRect();
      const isInsideMap =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;

      if (!isInsideMap) return;
      if (shouldKeepWheelForUi(event.target, container, event.deltaY)) return;

      event.preventDefault();
      event.stopPropagation();

      if (event.ctrlKey || event.metaKey) {
        const nextZoom = map.getZoom() + (event.deltaY < 0 ? 1 : -1);
        map.setZoomAround(
          map.mouseEventToContainerPoint(event),
          Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), nextZoom)),
        );
        return;
      }

      map.panBy(L.point(event.deltaX, event.deltaY), { animate: false });
    }

    window.addEventListener("wheel", onWheel, { capture: true, passive: false });
    return () => window.removeEventListener("wheel", onWheel, { capture: true });
  }, [map]);

  return null;
}
