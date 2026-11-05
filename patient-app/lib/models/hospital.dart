// Data models for the patient app, mirroring the backend JSON.

enum MappingStatus { unmapped, mappingPlanned, partiallyMapped, fullyMapped;
  static MappingStatus from(String? s) => switch (s) {
        'mapping_planned' => MappingStatus.mappingPlanned,
        'partially_mapped' => MappingStatus.partiallyMapped,
        'fully_mapped' => MappingStatus.fullyMapped,
        _ => MappingStatus.unmapped,
      };
  bool get isMapped => this != MappingStatus.unmapped;
}

class Hospital {
  final String id;
  final String name;
  final String? shortName;
  final String city;
  final String district;
  final String state;
  final String? address;
  final double? latitude;
  final double? longitude;
  final String? phoneEmergency;
  final String? hospitalType;
  final int? bedCount;
  final MappingStatus mappingStatus;
  final bool mapVerified;
  final String? mapLastUpdatedAt;
  final bool isDemo;
  final int buildingCount;
  final int publishedFloors;

  Hospital({
    required this.id,
    required this.name,
    this.shortName,
    required this.city,
    required this.district,
    this.state = 'Rajasthan',
    this.address,
    this.latitude,
    this.longitude,
    this.phoneEmergency,
    this.hospitalType,
    this.bedCount,
    this.mappingStatus = MappingStatus.unmapped,
    this.mapVerified = false,
    this.mapLastUpdatedAt,
    this.isDemo = false,
    this.buildingCount = 0,
    this.publishedFloors = 0,
  });

  factory Hospital.fromJson(Map<String, dynamic> j) => Hospital(
        id: j['id'] as String,
        name: j['name'] as String,
        shortName: j['short_name'] as String?,
        city: j['city'] as String,
        district: j['district'] as String,
        state: (j['state'] as String?) ?? 'Rajasthan',
        address: j['address'] as String?,
        latitude: j['latitude'] != null ? (j['latitude'] as num).toDouble() : null,
        longitude: j['longitude'] != null ? (j['longitude'] as num).toDouble() : null,
        phoneEmergency: j['phone_emergency'] as String?,
        hospitalType: j['hospital_type'] as String?,
        bedCount: j['bed_count'] != null ? (j['bed_count'] as num).toInt() : null,
        mappingStatus: MappingStatus.from(j['mapping_status'] as String?),
        mapVerified: (j['map_verified'] as num?)?.toInt() == 1,
        mapLastUpdatedAt: j['map_last_updated_at'] as String?,
        isDemo: (j['is_demo'] as num?)?.toInt() == 1,
        buildingCount: (j['building_count'] as num?)?.toInt() ?? 0,
        publishedFloors: (j['published_floors'] as num?)?.toInt() ?? 0,
      );
}

class Building {
  final String id;
  final String name;
  final String? code;
  final double? latitude;
  final double? longitude;
  final int floorCount;
  Building({required this.id, required this.name, this.code, this.latitude, this.longitude, this.floorCount = 0});
  factory Building.fromJson(Map<String, dynamic> j) => Building(
        id: j['id'] as String, name: j['name'] as String, code: j['code'] as String?,
        latitude: j['latitude'] != null ? (j['latitude'] as num).toDouble() : null,
        longitude: j['longitude'] != null ? (j['longitude'] as num).toDouble() : null,
        floorCount: (j['floor_count'] as num?)?.toInt() ?? 0,
      );
}

class Floor {
  final String id;
  final String buildingId;
  final int floorNumber;
  final String floorLabel;
  final double? levelElevationM;
  final String mapStatus;
  final bool isDemo;
  final double? calibrationScalePpm;
  final double? calibrationOriginX;
  final double? calibrationOriginY;
  final double? calibrationRotationDeg;
  final int? imageWidthPx;
  final int? imageHeightPx;
  Floor({
    required this.id, required this.buildingId, required this.floorNumber, required this.floorLabel,
    this.levelElevationM, required this.mapStatus, this.isDemo = false,
    this.calibrationScalePpm, this.calibrationOriginX, this.calibrationOriginY, this.calibrationRotationDeg,
    this.imageWidthPx, this.imageHeightPx,
  });
  factory Floor.fromJson(Map<String, dynamic> j) => Floor(
        id: j['id'] as String, buildingId: j['building_id'] as String,
        floorNumber: (j['floor_number'] as num).toInt(), floorLabel: j['floor_label'] as String,
        levelElevationM: j['level_elevation_m'] != null ? (j['level_elevation_m'] as num).toDouble() : null,
        mapStatus: j['map_status'] as String, isDemo: (j['is_demo'] as num?)?.toInt() == 1,
        calibrationScalePpm: j['calibration_scale_ppm'] != null ? (j['calibration_scale_ppm'] as num).toDouble() : null,
        calibrationOriginX: j['calibration_origin_x'] != null ? (j['calibration_origin_x'] as num).toDouble() : null,
        calibrationOriginY: j['calibration_origin_y'] != null ? (j['calibration_origin_y'] as num).toDouble() : null,
        calibrationRotationDeg: j['calibration_rotation_deg'] != null ? (j['calibration_rotation_deg'] as num).toDouble() : null,
        imageWidthPx: j['image_width_px'] != null ? (j['image_width_px'] as num).toInt() : null,
        imageHeightPx: j['image_height_px'] != null ? (j['image_height_px'] as num).toInt() : null,
      );
}

class Room {
  final String id;
  final String roomNumber;
  final String? name;
  final String? nameHi;
  final String? category;
  final String? departmentId;
  final double? xCentroid;
  final double? yCentroid;
  final String verificationStatus;
  final String? operatingInfo;
  Room({
    required this.id, required this.roomNumber, this.name, this.nameHi, this.category,
    this.departmentId, this.xCentroid, this.yCentroid, this.verificationStatus = 'unverified', this.operatingInfo,
  });
  factory Room.fromJson(Map<String, dynamic> j) => Room(
        id: j['id'] as String, roomNumber: j['room_number'] as String, name: j['name'] as String?,
        nameHi: j['name_hi'] as String?, category: j['category'] as String?, departmentId: j['department_id'] as String?,
        xCentroid: j['x_centroid'] != null ? (j['x_centroid'] as num).toDouble() : null,
        yCentroid: j['y_centroid'] != null ? (j['y_centroid'] as num).toDouble() : null,
        verificationStatus: j['verification_status'] as String? ?? 'unverified', operatingInfo: j['operating_info'] as String?,
      );
}

class SearchResult {
  final String type; // room | department | facility | doctor
  final String id;
  final String label;
  final String? labelHi;
  final String? floorId;
  final String? roomNumber;
  final String? category;
  final double? x;
  final double? y;
  SearchResult({required this.type, required this.id, required this.label, this.labelHi, this.floorId, this.roomNumber, this.category, this.x, this.y});
  factory SearchResult.fromJson(Map<String, dynamic> j) => SearchResult(
        type: j['type'] as String, id: j['id'] as String, label: j['label'] as String,
        labelHi: j['label_hi'] as String?, floorId: j['floor_id'] as String?, roomNumber: j['room_number'] as String?,
        category: j['category'] as String?,
        x: j['x'] != null ? (j['x'] as num).toDouble() : null,
        y: j['y'] != null ? (j['y'] as num).toDouble() : null,
      );
}

class QrLocation {
  final String id;
  final String hospitalId;
  final String buildingId;
  final String floorId;
  final String roomId;
  final String nodeId;
  final String locationIdentifier;
  final String label;
  final double? xMetres;
  final double? yMetres;
  final bool isActive;
  final String verificationStatus;
  QrLocation({required this.id, required this.hospitalId, required this.buildingId, required this.floorId, required this.roomId, required this.nodeId, required this.locationIdentifier, required this.label, this.xMetres, this.yMetres, this.isActive = true, this.verificationStatus = 'unverified'});
  factory QrLocation.fromJson(Map<String, dynamic> j) => QrLocation(
        id: j['id'] as String, hospitalId: j['hospital_id'] as String, buildingId: j['building_id'] as String,
        floorId: j['floor_id'] as String, roomId: (j['room_id'] as String?) ?? '', nodeId: (j['node_id'] as String?) ?? '',
        locationIdentifier: j['location_identifier'] as String, label: j['label'] as String,
        xMetres: j['x_metres'] != null ? (j['x_metres'] as num).toDouble() : null,
        yMetres: j['y_metres'] != null ? (j['y_metres'] as num).toDouble() : null,
        isActive: (j['is_active'] as num?)?.toInt() == 1, verificationStatus: j['verification_status'] as String? ?? 'unverified',
      );
}

class OfflineBundle {
  final Hospital hospital;
  final List<Building> buildings;
  final List<OfflineFloor> floors;
  final String generatedAt;
  OfflineBundle({required this.hospital, required this.buildings, required this.floors, required this.generatedAt});
  factory OfflineBundle.fromJson(Map<String, dynamic> j) => OfflineBundle(
        hospital: Hospital.fromJson(j['hospital'] as Map),
        buildings: (j['buildings'] as List).map((e) => Building.fromJson(e as Map)).toList(),
        floors: (j['floors'] as List).map((e) => OfflineFloor.fromJson(e as Map)).toList(),
        generatedAt: j['generated_at'] as String,
      );
}

class OfflineFloor {
  final String floorId;
  final String buildingId;
  final int floorNumber;
  final String floorLabel;
  final double? levelElevationM;
  final double? calibrationScalePpm;
  final double? calibrationOriginX;
  final double? calibrationOriginY;
  final double? calibrationRotationDeg;
  final int? imageWidthPx;
  final int? imageHeightPx;
  final List<Map<String, dynamic>> nodes;
  final List<Map<String, dynamic>> edges;
  OfflineFloor({required this.floorId, required this.buildingId, required this.floorNumber, required this.floorLabel, this.levelElevationM, this.calibrationScalePpm, this.calibrationOriginX, this.calibrationOriginY, this.calibrationRotationDeg, this.imageWidthPx, this.imageHeightPx, required this.nodes, required this.edges});
  factory OfflineFloor.fromJson(Map<String, dynamic> j) => OfflineFloor(
        floorId: j['floorId'] as String, buildingId: j['buildingId'] as String,
        floorNumber: (j['floorNumber'] as num).toInt(), floorLabel: j['floorLabel'] as String,
        levelElevationM: j['levelElevationM'] != null ? (j['levelElevationM'] as num).toDouble() : null,
        calibrationScalePpm: j['calibration_scale_ppm'] != null ? (j['calibration_scale_ppm'] as num).toDouble() : null,
        calibrationOriginX: j['calibration_origin_x'] != null ? (j['calibration_origin_x'] as num).toDouble() : null,
        calibrationOriginY: j['calibration_origin_y'] != null ? (j['calibration_origin_y'] as num).toDouble() : null,
        calibrationRotationDeg: j['calibration_rotation_deg'] != null ? (j['calibration_rotation_deg'] as num).toDouble() : null,
        imageWidthPx: j['image_width_px'] != null ? (j['image_width_px'] as num).toInt() : null,
        imageHeightPx: j['image_height_px'] != null ? (j['image_height_px'] as num).toInt() : null,
        nodes: (j['nodes'] as List).map((e) => e as Map).toList(),
        edges: (j['edges'] as List).map((e) => e as Map).toList(),
      );
}
