"""Regional road-graph routing from settlement to a GIS shelter."""

import json
import math
from xml.etree.ElementTree import ParseError

import networkx as nx
from fastapi import HTTPException

from app.services.region_registry import artifact_path, get_region


def _representative_position(geometry: dict) -> tuple[float, float] | None:
	def pairs(value: object) -> list[tuple[float, float]]:
		if not isinstance(value, list):
			return []
		if len(value) >= 2 and all(isinstance(item, (int, float)) for item in value[:2]):
			return [(float(value[0]), float(value[1]))]
		result: list[tuple[float, float]] = []
		for item in value:
			result.extend(pairs(item))
		return result

	coordinates = pairs(geometry.get("coordinates"))
	if not coordinates:
		return None
	return (sum(point[0] for point in coordinates) / len(coordinates), sum(point[1] for point in coordinates) / len(coordinates))


def _load_features(region_id: str, asset_name: str) -> list[dict]:
	path = artifact_path(region_id, asset_name)
	try:
		payload = json.loads(path.read_text(encoding="utf-8"))
	except (OSError, json.JSONDecodeError) as error:
		raise HTTPException(status_code=503, detail=f"Unable to read regional {asset_name}") from error
	return payload.get("features", [])


def _load_graph(region_id: str) -> nx.Graph:
	path = artifact_path(region_id, "roads.graphml")
	try:
		graph = nx.read_graphml(path)
	except (FileNotFoundError, OSError, ParseError, ValueError) as error:
		raise HTTPException(status_code=503, detail="Regional road graph is unavailable") from error
	if graph.number_of_nodes() < 2:
		raise HTTPException(status_code=503, detail="Regional road graph has insufficient nodes")
	return graph


def _nearest_node(graph: nx.Graph, position: tuple[float, float]) -> str:
	return min(graph.nodes, key=lambda node: math.hypot(float(graph.nodes[node].get("x", 0)) - position[0], float(graph.nodes[node].get("y", 0)) - position[1]))


def route_geojson(village_id: str, hazard_multiplier: float = 1.0, region_id: str = "mandakini") -> dict:
	region = get_region(region_id)
	if not any(village.get("id") == village_id for village in region.get("villages", [])):
		return {"type": "FeatureCollection", "features": []}
	settlement_feature = next((feature for feature in _load_features(region_id, "settlements.geojson") if feature.get("properties", {}).get("village_id") == village_id), None)
	settlement_position = _representative_position(settlement_feature.get("geometry", {})) if settlement_feature else None
	if settlement_position is None:
		raise HTTPException(status_code=503, detail="Settlement geometry is unavailable")
	shelters = _load_features(region_id, "shelters.geojson")
	available_shelters = [(feature, _representative_position(feature.get("geometry", {}))) for feature in shelters]
	available_shelters = [(feature, position) for feature, position in available_shelters if position is not None]
	if not available_shelters:
		raise HTTPException(status_code=503, detail="No usable shelter exists for this region")
	shelter, shelter_position = min(available_shelters, key=lambda item: math.hypot(item[1][0] - settlement_position[0], item[1][1] - settlement_position[1]))
	graph = _load_graph(region_id)
	start = _nearest_node(graph, settlement_position)
	end = _nearest_node(graph, shelter_position)
	for _, _, data in graph.edges(data=True):
		data["risk_cost"] = float(data.get("length", data.get("weight", 1))) * hazard_multiplier
	try:
		path = nx.shortest_path(graph, start, end, weight="risk_cost")
	except nx.NetworkXNoPath as error:
		raise HTTPException(status_code=503, detail="No evacuation route connects settlement to shelter") from error
	coordinates = [[float(graph.nodes[node]["x"]), float(graph.nodes[node]["y"])] for node in path]
	return {"type": "FeatureCollection", "features": [{"type": "Feature", "properties": {"region_id": region_id, "settlement_id": village_id, "shelter_id": shelter.get("properties", {}).get("shelter_id"), "hazard_weighted": hazard_multiplier != 1.0}, "geometry": {"type": "LineString", "coordinates": coordinates}}]}
