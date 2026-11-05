import 'package:flutter/material.dart';
import '../core/l10n.dart';
import '../engine/routing/graph.dart';

class StepCard extends StatelessWidget {
  final String emoji;
  final String kindLabel;
  final String text;
  final double distance;
  final String accessibility;
  final bool isVertical;
  final String? floorLabel;
  final bool isCurrent;
  final bool highlight;

  const StepCard({
    super.key,
    required this.emoji,
    required this.kindLabel,
    required this.text,
    required this.distance,
    required this.accessibility,
    required this.isVertical,
    this.floorLabel,
    this.isCurrent = false,
    this.highlight = false,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      color: highlight ? theme.colorScheme.primaryContainer : null,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 48,
              height: 48,
              child: Card(
                elevation: 0,
                child: Center(child: Text(emoji, style: const TextStyle(fontSize: 24))),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [
                    Text(text, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                    const SizedBox(width: 8),
                    if (isVertical && floorLabel != null)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(color: theme.colorScheme.secondaryContainer, borderRadius: BorderRadius.circular(6)),
                        child: Text(floorLabel!, style: TextStyle(fontSize: 11, color: theme.colorScheme.onSecondaryContainer)),
                      ),
                  ]),
                  const SizedBox(height: 4),
                  Row(children: [
                    Text('$distance m · $kindLabel', style: theme.textTheme.bodySmall),
                    const SizedBox(width: 8),
                    if (highlight)
                      const Icon(Icons.arrow_forward, size: 16, color: Colors.black)
                    else
                      Icon(AccessibilityClass.wheelchairAccessible == AccessibilityClass.wheelchairAccessible ? Icons.accessibility_new : Icons.accessibility_new, size: 16),
                    const SizedBox(width: 4),
                    Text(accessibility, style: theme.textTheme.bodySmall),
                  ]),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
