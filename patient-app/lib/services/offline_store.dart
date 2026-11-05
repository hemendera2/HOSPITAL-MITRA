import 'dart:convert';
import 'dart:io';
import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';
import '../models/hospital.dart';

// Local SQLite-backed offline store. Downloads approved hospital map bundles
// and lets the app search + navigate fully offline. Tracks last-updated date
// so stale maps can be flagged.

class OfflineStore {
  static const String _db = 'hospital_mitra_offline.db';
  static const String _tHospital = 'offline_hospital';
  static const String _tFloor = 'offline_floor';

  static Future<Database> get db async {
    final dir = await getDatabasesPath();
    await Directory(dir).create(recursive: true);
    return openDatabase(join(dir, _db), version: 1, onCreate: _create);
  }

  static Future<void> _create(Database db, int version) async {
    await db.execute('CREATE TABLE $_tHospital (id TEXT PRIMARY KEY, name TEXT, city TEXT, data TEXT, updated_at TEXT)');
    await db.execute('CREATE TABLE $_tFloor (id TEXT PRIMARY KEY, hospital_id TEXT, floor_id TEXT, data TEXT)');
  }

  // Save a raw JSON bundle (from the backend /offline-bundle endpoint).
  static Future<void> saveBundle(Map<String, dynamic> bundleJson) async {
    final db = await OfflineStore.db;
    final hospital = bundleJson['hospital'] as Map;
    final hId = hospital['id'] as String;
    final hName = hospital['name'] as String;
    final hCity = hospital['city'] as String;
    final generatedAt = bundleJson['generated_at'] as String? ?? '';
    await db.transaction((tx) async {
      await tx.delete(_tHospital, where: 'id = ?', whereArgs: [hId]);
      await tx.delete(_tFloor, where: 'hospital_id = ?', whereArgs: [hId]);
      await tx.insert(_tHospital, {
        'id': hId, 'name': hName, 'city': hCity,
        'data': jsonEncode(bundleJson), 'updated_at': generatedAt,
      });
      for (final f in bundleJson['floors'] as List) {
        final fMap = f as Map;
        await tx.insert(_tFloor, {
          'id': fMap['floorId'] as String,
          'hospital_id': hId,
          'floor_id': fMap['floorId'] as String,
          'data': jsonEncode(fMap),
        });
      }
    });
  }

  static Future<List<OfflineHospitalMeta>> listHospitals() async {
    final db = await OfflineStore.db;
    final rows = await db.query(_tHospital, orderBy: 'name');
    return rows.map((r) => OfflineHospitalMeta(
      id: r['id'] as String, name: r['name'] as String, city: r['city'] as String, updatedAt: r['updated_at'] as String,
    )).toList();
  }

  static Future<OfflineBundle?> loadBundle(String hospitalId) async {
    final db = await OfflineStore.db;
    final rows = await db.query(_tHospital, where: 'id = ?', whereArgs: [hospitalId]);
    if (rows.isEmpty) return null;
    final raw = jsonDecode(rows.first['data'] as String) as Map<String, dynamic>;
    return OfflineBundle.fromJson(raw);
  }

  static Future<bool> isDownloaded(String hospitalId) async {
    final db = await OfflineStore.db;
    final rows = await db.query(_tHospital, where: 'id = ?', whereArgs: [hospitalId]);
    return rows.isNotEmpty;
  }

  static Future<void> deleteHospital(String hospitalId) async {
    final db = await OfflineStore.db;
    await db.transaction((tx) async {
      await tx.delete(_tHospital, where: 'id = ?', whereArgs: [hospitalId]);
      await tx.delete(_tFloor, where: 'hospital_id = ?', whereArgs: [hospitalId]);
    });
  }
}

class OfflineHospitalMeta {
  final String id;
  final String name;
  final String city;
  final String updatedAt;
  OfflineHospitalMeta({required this.id, required this.name, required this.city, required this.updatedAt});
}
