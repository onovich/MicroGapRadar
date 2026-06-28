import { deleteRadarTaskAction } from "@/app/radar-tasks/actions";

type RadarTaskDeleteControlProps = {
  id: string;
};

export function RadarTaskDeleteControl({ id }: RadarTaskDeleteControlProps) {
  const action = deleteRadarTaskAction.bind(null, id);

  return (
    <form action={action} className="rounded-lg border border-red-200 bg-red-50 p-5">
      <h2 className="text-lg font-semibold text-red-800">Deactivate radar</h2>
      <p className="mt-2 text-sm leading-6 text-red-700">
        This deactivates the task and preserves historical runs and opportunities.
      </p>
      <label className="mt-4 flex items-center gap-3 text-sm font-medium text-red-700">
        <input
          className="h-4 w-4 accent-red-700"
          name="confirmDeactivate"
          required
          type="checkbox"
        />
        I understand this deactivates the radar and keeps history.
      </label>
      <button
        className="mt-4 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
        type="submit"
      >
        Deactivate
      </button>
    </form>
  );
}
