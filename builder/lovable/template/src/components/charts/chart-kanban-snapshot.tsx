import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { KanbanSnapshot } from "@/components/charts/lib/mfg"
const columns = [
  { name: "Backlog", cards: [{ title: "Card export" }, { title: "Rate limits" }, { title: "Audit log" }] },
  { name: "In progress", wipLimit: 3, cards: [{ title: "Neon auth", age: 4 }, { title: "RLS policies", age: 2 }] },
  { name: "Review", wipLimit: 2, cards: [{ title: "Seed rows", age: 9 }, { title: "Data API", age: 6 }, { title: "Meta tags", age: 11 }] },
  { name: "Done", cards: [{ title: "Site delete", age: 1 }, { title: "Uploads", age: 2 }] },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>The board right now</CardTitle>
        <CardDescription>Each column against its WIP limit</CardDescription>
      </CardHeader>
      <CardContent>
        <KanbanSnapshot columns={columns} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Review is over its limit <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Thicker left edge is an older card
        </div>
      </CardFooter>
    </Card>
  )
}
