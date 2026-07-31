import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ConeChart } from "@/components/charts/lib/ceramics"
const cones = [
  { name: "04", slowC: 1050, fastC: 1077 },
  { name: "1", slowC: 1137, fastC: 1154 },
  { name: "5", slowC: 1177, fastC: 1196 },
  { name: "6", slowC: 1201, fastC: 1222 },
  { name: "10", slowC: 1285, fastC: 1305 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pyrometric cones</CardTitle>
        <CardDescription>Heatwork, not temperature</CardDescription>
      </CardHeader>
      <CardContent>
        <ConeChart cones={cones} rampC={60} scheduleName="a 60°C/h climb" />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A pyrometer agreeing with a cone chart proves nothing <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Climbing at 60°C/h
        </div>
      </CardFooter>
    </Card>
  )
}
