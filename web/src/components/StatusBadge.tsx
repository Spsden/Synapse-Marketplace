type Status = string;

const colorMap: Record<string, string> = {
  PUBLISHED: "bg-green-100 text-green-800 border-green-200",
  SUBMITTED: "bg-yellow-100 text-yellow-800 border-yellow-200",
  PENDING_REVIEW: "bg-blue-100 text-blue-800 border-blue-200",
  REJECTED: "bg-red-100 text-red-800 border-red-200",
  FLAGGED: "bg-red-100 text-red-800 border-red-200",
  DELETED: "bg-gray-100 text-gray-600 border-gray-200",
  APPROVED: "bg-green-100 text-green-800 border-green-200",
};

export default function StatusBadge({ status }: { status: Status }) {
  const classes = colorMap[status] ?? "bg-gray-100 text-gray-600 border-gray-200";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${classes}`}
    >
      {status}
    </span>
  );
}
