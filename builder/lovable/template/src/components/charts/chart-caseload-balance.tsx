import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CaseloadBalance } from "@/components/charts/lib/legal"
const earners = [
  { name: "Adeyemi", matters: [{ complexity: 5 }, { complexity: 1 }, { complexity: 1 }, { complexity: 2 }] },
  { name: "Brandt", matters: [{ complexity: 1 }, { complexity: 1 }, { complexity: 2 }, { complexity: 2 }] },
  { name: "Castellanos", matters: [{ complexity: 5 }, { complexity: 5 }, { complexity: 2 }] },
  { name: "Duong", matters: [{ complexity: 1 }, { complexity: 1 }, { complexity: 1 }, { complexity: 1 }] },
  { name: "Egerton", matters: [{ complexity: 2 }, { complexity: 5 }, { complexity: 1 }] },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Caseload</CardTitle>
        <CardDescription>Matters per fee earner, weighted by complexity</CardDescription>
      </CardHeader>
      <CardContent>
        <CaseloadBalance earners={earners} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Count is even, weighted load is not <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Litigation team
        </div>
      </CardFooter>
    </Card>
  )
}
