import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/hospital.dart';
import '../engine/routing/graph.dart';

// API client for the patient app. Talks to the Hospital Mitra backend. In
// production this could be swapped for the Supabase JS client; the patient
// public endpoints are identical.

class ApiException implements Exception {
  final int status;
  final String message;
  ApiException(this.status, this.message);
  @override
  String toString() => 'ApiException($status): $message';
}

class ApiService {
  final String baseUrl;
  ApiService({this.baseUrl = 'http://10.0.2.2:8787'}); // Android emulator → host

  Future<Map<String, dynamic>> _req(String method, String path, {Map<String, dynamic>? body}) async {
    final url = Uri.parse('$baseUrl$path');
    final res = await http.post(url, headers: {'Content-Type': 'application/json'}, body: body != null ? jsonEncode(body) : null);
    final data = jsonDecode(res.body) as Map<String, dynamic>;
    if (res.statusCode >= 400) {
      throw ApiException(res.statusCode, data['error']?['message'] as String? ?? 'Request failed');
    }
    return data;
  }

  Future<List<Hospital>> hospitals({String? search, String? city}) async {
    final q = [search != null ? 'search=$search' : null, city != null ? 'city=$city' : null].whereType<String>().join('&');
    final data = await _req('GET', '/api/patient/hospitals?$q');
    return (data['hospitals'] as List).map((e) => Hospital.fromJson(e as Map)).toList();
  }

  Future<HospitalDetail> hospitalDetail(String id) async {
    final data = await _req('GET', '/api/patient/hospitals/$id');
    return HospitalDetail.fromJson(data);
  }

  Future<List<SearchResult>> search(String hospitalId, String q) async {
    final data = await _req('GET', '/api/patient/hospitals/$hospitalId/search?q=$q');
    return (data['results'] as List).map((e) => SearchResult.fromJson(e as Map)).toList();
  }

  Future<FloorGraph> floorGraph(String hospitalId, String floorId) async {
    final data = await _req('GET', '/api/patient/hospitals/$hospitalId/floors/$floorId/graph');
    return FloorGraph.fromJson(data['floorGraph'] as Map);
  }

  Future<RouteResult> route(String hospitalId, String startNodeId, String endNodeId, {bool wheelchairOnly = false}) async {
    final data = await _req('POST', '/api/patient/hospitals/$hospitalId/route',
        body: {'start_node_id': startNodeId, 'end_node_id': endNodeId, 'wheelchair_only': wheelchairOnly});
    return _routeFromJson(data);
  }

  Future<Map<String, dynamic>> offlineBundleRaw(String hospitalId) async {
    return await _req('GET', '/api/patient/hospitals/$hospitalId/offline-bundle');
  }

  Future<QrLocation> resolveQr(String identifier, {String? hospitalId}) async {
    final q = hospitalId != null ? '?hospital_id=$hospitalId' : '';
    final data = await _req('GET', '/api/patient/qr/resolve/$identifier$q');
    return QrLocation.fromJson(data['location'] as Map);
  }

  Future<void> submitFeedback(String hospitalId, Map<String, dynamic> body) async {
    await _req('POST', '/api/patient/hospitals/$hospitalId/feedback', body: body);
  }

  RouteResult _routeFromJson(Map<String, dynamic> j) => RouteResult(
        startNodeId: j['startNodeId'] as String,
        endNodeId: j['endNodeId'] as String,
        startFloorId: j['startFloorId'] as String,
        endFloorId: j['endFloorId'] as String,
        totalDistanceMetres: (j['totalDistanceMetres'] as num).toDouble(),
        estimatedWalkingTimeSeconds: (j['estimatedWalkingTimeSeconds'] as num).toInt(),
        steps: (j['steps'] as List).map((e) => RouteStep(
              fromNodeId: e['fromNodeId'] as String, toNodeId: e['toNodeId'] as String, floorId: e['floorId'] as String,
              kind: e['kind'] as String, distanceMetres: (e['distanceMetres'] as num).toDouble(),
              instruction: e['instruction'] as String, instructionHindi: e['instructionHindi'] as String,
              accessibility: AccessibilityClass.fromString(e['accessibility'] as String),
              isVertical: (e['isVertical'] as bool?) ?? false, toFloorLabel: e['toFloorLabel'] as String?,
            )).toList(),
        pathNodeIds: (j['pathNodeIds'] as List).map((e) => e as String).toList(),
        accessible: (j['accessible'] as bool?) ?? false,
        algorithm: j['algorithm'] as String,
        found: (j['found'] as bool?) ?? false,
      );
}

class HospitalDetail {
  final Hospital hospital;
  final List<Building> buildings;
  final List<Floor> floors;
  final List<Map<String, dynamic>> departments;
  final List<Map<String, dynamic>> facilities;
  final List<Map<String, dynamic>> doctors;
  HospitalDetail({required this.hospital, required this.buildings, required this.floors, required this.departments, required this.facilities, required this.doctors});
  factory HospitalDetail.fromJson(Map<String, dynamic> j) => HospitalDetail(
        hospital: Hospital.fromJson(j['hospital'] as Map),
        buildings: (j['buildings'] as List).map((e) => Building.fromJson(e as Map)).toList(),
        floors: (j['floors'] as List).map((e) => Floor.fromJson(e as Map)).toList(),
        departments: (j['departments'] as List).map((e) => e as Map).toList(),
        facilities: (j['facilities'] as List).map((e) => e as Map).toList(),
        doctors: (j['doctors'] as List).map((e) => e as Map).toList(),
      );
}
