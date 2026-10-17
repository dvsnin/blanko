/** «Воспитатели», если в тексте несколько имён (есть запятая), иначе «Воспитатель». */
export function teachersLabel(teachers: string): string {
  return teachers.includes(",") ? "Воспитатели" : "Воспитатель";
}
