import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../core/app_state.dart';
import '../core/l10n.dart';
import '../core/routes.dart';
import '../services/api_service.dart';

class QrScreen extends StatefulWidget {
  const QrScreen({super.key});
  @override
  State<QrScreen> createState() => _QrScreenState();
}

class _QrScreenState extends State<QrScreen> {
  bool _loading = false;

  Future<void> _onDetect(BarcodeCapture capture) async {
    final barcodes = capture.barcodes;
    if (barcodes.isEmpty) return;
    final code = barcodes.first.rawValue;
    if (code == null || code.isEmpty) return;
    setState(() => _loading = true);
    try {
      final state = context.read<AppState>();
      final loc = await state.api.resolveQr(code, hospitalId: state.selectedHospitalId.value);
      setState(() => _loading = false);
      if (mounted) {
        Navigator.of(context).pushNamed('/map', arguments: MapArgs(hospitalId: state.selectedHospitalId.value ?? loc.hospitalId, floorId: loc.floorId));
      }
    } on ApiException catch (e) {
      setState(() => _loading = false);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('${e.status}: ${e.message}')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.watch<AppState>().l10n;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.t('qr_scan'))),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : MobileScanner(
              controller: MobileScannerController(usetorch: true, invertColors: false, detectionHint: DetectionHint.QR_CODE),
              detectorCallback: _onDetect,
            ),
    );
  }
}
