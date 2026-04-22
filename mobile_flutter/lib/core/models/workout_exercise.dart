class WorkoutExercise {
  const WorkoutExercise({
    required this.id,
    required this.name,
    required this.category,
    this.image,
    this.imageThumbnail,
  });

  final int id;
  final String name;
  final String category;
  final String? image;
  final String? imageThumbnail;

  factory WorkoutExercise.fromJson(Map<String, dynamic> json) {
    return WorkoutExercise(
      id: (json['id'] as num?)?.toInt() ?? 0,
      name: json['name']?.toString() ?? 'Unknown',
      category: json['category']?.toString() ?? 'Other',
      image: json['image']?.toString(),
      imageThumbnail: json['imageThumbnail']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'category': category,
      'image': image,
      'imageThumbnail': imageThumbnail,
    };
  }
}
