import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/app_state.dart';
import '../core/l10n.dart';
import '../services/api_service.dart';

class FeedbackScreen extends StatefulWidget {
  const FeedbackScreen({super.key, required this.hospitalId});
  final String hospitalId;
  @override
  State<FeedbackScreen> createState() => _FeedbackScreenState();
}

class _FeedbackScreenState extends State<FeedbackScreen> {
  final _category = TextEditingController(text: 'wrong_location');
  final _desc = TextEditingController();

  Future<void> _submit() async {
    try {
      final state = context.read<AppState>();
      await state.api.submitFeedback(widget.hospitalId, {
        'category': _category.text,
        'description': _desc.text,
        'location_identifier': _desc.text.length > 0 ? 'manual' : 'manual',
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Thank you — your feedback helps keep maps accurate.')));
        Navigator.of(context).pop();
      }
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('${e.status}')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.watch<AppState>().l10n;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.t('feedback'))),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            DropdownButtonFormField<String>(
              value: _category.text,
              items: const [
                DropdownMenuItem(value: 'wrong_location', child: Text('Wrong location')),
                DropdownMenuItem(value: 'missing_room', child: Text('Missing room')),
                DropdownMenuItem(value: 'accessibility', child: Text('Accessibility issue')),
                DropdownMenuItem(value: 'other', child: Text('Other')),
              ],
              onChanged: (v) => v != null && _category.value = v,
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _desc,
              maxLines: 4,
              decoration: InputDecoration(hintText: 'What is wrong?', border: OutlineInputBorder(borderRadius: BorderRadius.circular(14))),
            ),
            const SizedBox(height: 24),
            FilledButton.icon(onPressed: _submit, icon: const Icon(Icons.send), label: Text(l10n.t('submit'))),
          ],
        ),
      ),
    );
  }
}
