import { ViewObject, ElementObject, ModelData } from '../model/types';

export function buildViewListData(views: ViewObject[]): Record<string, unknown> {
  return { views: views.map(v => ({ name: v.name })) };
}

export function buildViewDetailsData(model: ModelData, view: ViewObject): Record<string, unknown> {
  const data: Record<string, unknown> = { name: view.name };
  if (view.viewpoint) data.viewpoint = view.viewpoint;
  if (view.documentation) data.documentation = view.documentation;

  const elements: Record<string, unknown>[] = [];
  if (view.elements) {
    for (const eid of view.elements) {
      const el = model.elements.find(e => e.id === eid);
      if (!el) continue;
      const elData: Record<string, unknown> = { name: el.name };
      if (el.type) elData.type = el.type;
      if (el.documentation) elData.documentation = el.documentation;
      if (el.properties && Object.keys(el.properties).length > 0) {
        elData.properties = { ...el.properties };
      }
      elements.push(elData);
    }
  }
  data.elements = elements;

  const relationships: Record<string, unknown>[] = [];
  if (view.relationships) {
    for (const rid of view.relationships) {
      const r = model.relationships.find(rel => rel.id === rid);
      if (!r) continue;
      const source = model.elements.find(e => e.id === r.sourceId);
      const target = model.elements.find(e => e.id === r.targetId);
      const relData: Record<string, unknown> = {
        source: source?.name || r.sourceId,
        target: target?.name || r.targetId,
      };
      if (r.type) relData.type = r.type;
      if (r.name) relData.name = r.name;
      if (r.documentation) relData.documentation = r.documentation;
      if (r.properties && Object.keys(r.properties).length > 0) {
        relData.properties = { ...r.properties };
      }
      relationships.push(relData);
    }
  }
  if (view.nodeHierarchy) {
    for (const h of view.nodeHierarchy) {
      const parent = model.elements.find(e => e.id === h.parentElement);
      const child = model.elements.find(e => e.id === h.childElement);
      const implicitRel = model.relationships.find(r =>
        (r.sourceId === h.parentElement && r.targetId === h.childElement) ||
        (r.sourceId === h.childElement && r.targetId === h.parentElement)
      );
      const relData: Record<string, unknown> = {
        source: parent?.name || h.parentElement,
        target: child?.name || h.childElement,
      };
      if (implicitRel) {
        relData.type = `${implicitRel.type} (implicit from view nesting)`;
        if (implicitRel.name) relData.name = implicitRel.name;
        if (implicitRel.documentation) relData.documentation = implicitRel.documentation;
        if (implicitRel.properties && Object.keys(implicitRel.properties).length > 0) {
          relData.properties = { ...implicitRel.properties };
        }
      } else {
        relData.type = 'Containment (implicit from view nesting)';
      }
      relationships.push(relData);
    }
  }
  data.relationships = relationships;

  return data;
}

export function buildElementListData(elements: ElementObject[]): Record<string, unknown> {
  return {
    elements: elements.map(e => ({
      name: e.name,
      type: e.type || 'Unknown Type'
    }))
  };
}

export function buildElementDetailsData(model: ModelData, element: ElementObject): Record<string, unknown> {
  const data: Record<string, unknown> = { name: element.name };
  if (element.type) data.type = element.type;
  if (element.documentation) data.documentation = element.documentation;

  if (element.properties && Object.keys(element.properties).length > 0) {
    data.properties = { ...element.properties };
  }

  if (element.inViews && element.inViews.length > 0) {
    data.inViews = element.inViews
      .map(vid => model.views.find(v => v.id === vid))
      .filter(v => v)
      .map(v => v!.name);
  }

  const outgoing = element.outgoingRelations
    ?.map(rid => model.relationships.find(r => r.id === rid))
    .filter(r => r) || [];
  const incoming = element.incomingRelations
    ?.map(rid => model.relationships.find(r => r.id === rid))
    .filter(r => r) || [];

  if (outgoing.length > 0 || incoming.length > 0) {
    const rels: Record<string, unknown> = {};

    if (outgoing.length > 0) {
      rels.outgoing = outgoing.map(rel => {
        if (!rel) return null;
        const target = model.elements.find(e => e.id === rel.targetId);
        const r: Record<string, unknown> = { target: target?.name || rel.targetId };
        if (rel.type) r.type = rel.type;
        if (rel.name) r.name = rel.name;
        if (rel.documentation) r.documentation = rel.documentation;
        return r;
      }).filter(Boolean);
    }

    if (incoming.length > 0) {
      rels.incoming = incoming.map(rel => {
        if (!rel) return null;
        const source = model.elements.find(e => e.id === rel.sourceId);
        const r: Record<string, unknown> = { source: source?.name || rel.sourceId };
        if (rel.type) r.type = rel.type;
        if (rel.name) r.name = rel.name;
        if (rel.documentation) r.documentation = rel.documentation;
        return r;
      }).filter(Boolean);
    }

    data.relationships = rels;
  }

  return data;
}

export function withDisclaimerField(data: Record<string, unknown>, disclaimer?: string): Record<string, unknown> {
  if (!disclaimer) return data;
  return { disclaimer, ...data };
}
