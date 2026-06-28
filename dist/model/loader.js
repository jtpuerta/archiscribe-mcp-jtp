"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModelLoader = void 0;
const fs_1 = require("fs");
const fs_2 = require("fs");
const fast_xml_parser_1 = require("fast-xml-parser");
const logger_1 = require("../utils/logger");
const logger = (0, logger_1.getLogger)();
function attr(obj, name) {
    if (!obj)
        return undefined;
    const keys = Object.keys(obj);
    for (const k of keys) {
        if (k.toLowerCase().endsWith(name.toLowerCase()))
            return obj[k];
    }
    return undefined;
}
function asArray(v) {
    if (v === undefined || v === null)
        return [];
    return Array.isArray(v) ? v : [v];
}
class ModelLoader {
    constructor(path) {
        this.watcherInitialized = false;
        this.path = path;
        this.initWatcher();
    }
    initWatcher() {
        if (this.watcherInitialized)
            return;
        try {
            (0, fs_2.watchFile)(this.path, { persistent: true, interval: 5000 }, (curr, prev) => {
                if (curr.mtime !== prev.mtime) {
                    this.cache = undefined;
                    // Log to output when file watcher triggers, with timestamp
                    const ts = new Date().toISOString();
                    logger.log('info', 'model.file.update', { path: this.path });
                }
            });
            this.watcherInitialized = true;
        }
        catch (err) {
            // Ignore watcher errors
        }
    }
    load() {
        if (this.cache)
            return this.cache;
        try {
            const xml = (0, fs_1.readFileSync)(this.path, 'utf8');
            const parsed = this.parseXml(xml);
            const model = parsed.model || parsed;
            const propDefs = this.parsePropertyDefinitions(model);
            const elements = this.parseElements(model, propDefs);
            const relationships = this.parseRelationships(model, propDefs);
            const views = this.parseViews(model, propDefs);
            this.cache = { views, elements, relationships };
            logger.log('info', 'model.load.success', { path: this.path, views: views.length, elements: elements.length, relationships: relationships.length });
            return this.cache;
        }
        catch (err) {
            this.cache = { views: [], elements: [], relationships: [] };
            logger.log('warn', 'model.load.fail', { path: this.path, error: err?.message || String(err) });
            return this.cache;
        }
    }
    parseXml(xml) {
        const parser = new fast_xml_parser_1.XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '@',
            textNodeName: '#text',
            removeNSPrefix: true
        });
        return parser.parse(xml);
    }
    parsePropertyDefinitions(model) {
        const propDefsRaw = asArray(model.propertyDefinitions && model.propertyDefinitions.propertyDefinition);
        const propDefs = new Map();
        for (const pd of propDefsRaw) {
            const id = attr(pd, 'identifier') || attr(pd, 'id');
            const name = pd.name ? (typeof pd.name === 'string' ? pd.name : pd.name['#text']) : undefined;
            if (id && name)
                propDefs.set(id, name);
        }
        return propDefs;
    }
    parseProperties(propertiesData, propDefs) {
        const props = {};
        const propsRaw = asArray(propertiesData && propertiesData.property);
        for (const p of propsRaw) {
            const ref = attr(p, 'propertyDefinitionRef');
            const val = p.value ? (typeof p.value === 'string' ? p.value : p.value['#text']) : undefined;
            if (ref) {
                const pname = propDefs.get(ref) || ref;
                if (val !== undefined)
                    props[pname] = val;
            }
        }
        return props;
    }
    parseElements(model, propDefs) {
        const elementsRaw = asArray(model.elements && model.elements.element);
        const elements = elementsRaw.map((el) => {
            const id = attr(el, 'identifier') || attr(el, 'id');
            const type = attr(el, 'type');
            const name = el.name ? (typeof el.name === 'string' ? el.name : el.name['#text']) : id;
            const documentation = el.documentation ? (typeof el.documentation === 'string' ? el.documentation : el.documentation['#text']) : undefined;
            const properties = this.parseProperties(el.properties, propDefs);
            return {
                id,
                type,
                name,
                documentation,
                properties,
                inViews: [],
                outgoingRelations: [],
                incomingRelations: []
            };
        });
        // Post-process to populate relationship and view references
        const viewsRaw = asArray((model.views && model.views.diagrams && model.views.diagrams.view) || (model.views && model.views.view));
        const relsRaw = asArray(model.relationships && model.relationships.relationship);
        // Map for quick element lookup
        const elementMap = new Map(elements.map(e => [e.id, e]));
        // Add view references
        for (const view of viewsRaw) {
            const viewId = attr(view, 'identifier') || attr(view, 'id');
            const { elementsInView } = this.parseViewNodes(view.node);
            for (const elementId of elementsInView) {
                const element = elementMap.get(elementId);
                if (element && !element.inViews.includes(viewId)) {
                    element.inViews.push(viewId);
                }
            }
        }
        // Add relationship references
        for (const rel of relsRaw) {
            const relId = attr(rel, 'identifier') || attr(rel, 'id');
            const sourceId = attr(rel, 'source');
            const targetId = attr(rel, 'target');
            const source = elementMap.get(sourceId);
            const target = elementMap.get(targetId);
            if (source && !source.outgoingRelations.includes(relId)) {
                source.outgoingRelations.push(relId);
            }
            if (target && !target.incomingRelations.includes(relId)) {
                target.incomingRelations.push(relId);
            }
        }
        return elements;
    }
    parseRelationships(model, propDefs) {
        const relsRaw = asArray(model.relationships && model.relationships.relationship);
        return relsRaw.map((r) => {
            const id = attr(r, 'identifier') || attr(r, 'id');
            const type = attr(r, 'type');
            const source = attr(r, 'source');
            const target = attr(r, 'target');
            const name = r.name ? (typeof r.name === 'string' ? r.name : r.name['#text']) : undefined;
            const documentation = r.documentation ? (typeof r.documentation === 'string' ? r.documentation : r.documentation['#text']) : undefined;
            const properties = this.parseProperties(r.properties, propDefs);
            const accessType = attr(r, 'accessType'); // For Access relationships
            return { id, type, sourceId: source, targetId: target, name, documentation, properties, accessType };
        });
    }
    parseViews(model, propDefs) {
        const viewsRaw = asArray((model.views && model.views.diagrams && model.views.diagrams.view) || (model.views && model.views.view));
        return viewsRaw.map((v) => {
            const id = attr(v, 'identifier') || attr(v, 'id');
            const name = v.name ? (typeof v.name === 'string' ? v.name : v.name['#text']) : id;
            const documentation = v.documentation ? (typeof v.documentation === 'string' ? v.documentation : v.documentation['#text']) : undefined;
            const properties = this.parseProperties(v.properties, propDefs);
            const viewpoint = attr(v, 'viewpoint');
            const { elementsInView, nodeHierarchy } = this.parseViewNodes(v.node);
            const relsInView = this.parseViewConnections(v.connection);
            const type = attr(v, 'type');
            return {
                id,
                type,
                name,
                documentation,
                properties,
                viewpoint,
                elements: elementsInView,
                relationships: relsInView,
                nodeHierarchy
            };
        });
    }
    parseViewNodes(nodeData) {
        const nodeList = asArray(nodeData);
        const elementsInView = [];
        const nodeHierarchy = [];
        // Recursive function to process nodes at any nesting level
        const processNode = (node, parentElementRef) => {
            const eref = attr(node, 'elementRef') || attr(node, 'elementref');
            if (eref) {
                elementsInView.push(eref);
                if (parentElementRef) {
                    nodeHierarchy.push({ parentElement: parentElementRef, childElement: eref });
                }
            }
            // Process nested nodes recursively
            const nested = asArray(node.node);
            for (const nestedNode of nested) {
                processNode(nestedNode, eref);
            }
        };
        // Process all top-level nodes
        for (const n of nodeList) {
            processNode(n);
        }
        return { elementsInView, nodeHierarchy };
    }
    parseViewConnections(connectionData) {
        const connList = asArray(connectionData);
        const relsInView = [];
        for (const c of connList) {
            const rref = attr(c, 'relationshipRef') || attr(c, 'relationshipref');
            if (rref)
                relsInView.push(rref);
        }
        return relsInView;
    }
    reload() {
        this.cache = undefined;
        return this.load();
    }
}
exports.ModelLoader = ModelLoader;
