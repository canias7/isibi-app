import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { LockWait } from "@/components/charts/lib/dbperf"
const chains = [
  { pid: 4021, query: "UPDATE stock SET qty…", waitingMs: 0 },
  { pid: 4088, query: "UPDATE stock SET qty…", waitingMs: 18400, blockedBy: 4021 },
  { pid: 4102, query: "SELECT … FOR UPDATE", waitingMs: 16100, blockedBy: 4088 },
  { pid: 4117, query: "DELETE FROM basket…", waitingMs: 9200, blockedBy: 4088 },
  { pid: 4130, query: "INSERT INTO orders…", waitingMs: 3100, blockedBy: 4102 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Who is blocking whom</CardTitle>
        <CardDescription>The wait chain</CardDescription>
      </CardHeader>
      <CardContent>
        <LockWait chains={chains} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Kill the head, free the chain <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Live
        </div>
      </CardFooter>
    </Card>
  )
}
