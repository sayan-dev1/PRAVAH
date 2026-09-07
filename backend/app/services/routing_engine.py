"""NetworkX risk-weighted routing with a GIS asset fallback."""

import json
from xml.etree.ElementTree import ParseError

import networkx as nx

from app.core.config import BASE_DIR


def _load_graph() -> nx.Graph | None:
	path = BASE_DIR.parent / "gis" / "outputs" / "rudraprayag_roads.graphml"
	try:
		return nx.read_graphml(path)
	except (FileNotFoundError, OSError, ParseError, ValueError):
		return None


def route_geojson(village_id: str, hazard_multiplier: float = 1.0) -> dict:
	if village_id != "VIL_TILWARA":
		return {"type": "FeatureCollection", "features": []}
	graph = _load_graph()
	if graph and graph.number_of_nodes() >= 2:
		for start, end, data in graph.edges(data=True):
			data["risk_cost"] = float(data.get("length", data.get("weight", 1))) * hazard_multiplier
		try:
			start, end = list(graph.nodes)[:2]
			path = nx.shortest_path(graph, start, end, weight="risk_cost")
			coordinates = [[float(graph.nodes[node].get("x")), float(graph.nodes[node].get("y"))] for node in path]
			return {"type": "FeatureCollection", "features": [{"type": "Feature", "properties": {"hazard_multiplier": hazard_multiplier}, "geometry": {"type": "LineString", "coordinates": coordinates}}]}
		except (nx.NetworkXNoPath, KeyError, TypeError, ValueError):
			pass
	path = BASE_DIR / "data" / "evac_route_tilwara.geojson"
	try:
		return json.loads(path.read_text(encoding="utf-8"))
	except (FileNotFoundError, json.JSONDecodeError):
		return {"type": "FeatureCollection", "features": []}
