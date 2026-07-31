import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { NineBox } from "@/components/charts/lib/hr"
const NAMES = ["Adeyemi", "Brandt", "Costa", "Dlamini", "Erikson", "Farouk", "Gupta", "Haugen", "Ibrahim", "Jensen", "Kaur", "Lindqvist", "Moreau", "Nakamura", "Okonkwo", "Petrov", "Quinn", "Rossi"]
const P = [[1,1],[1,1],[2,2],[2,1],[1,2],[0,1],[1,0],[2,0],[1,1],[0,0],[2,1],[1,2],[1,1],[0,2],[2,2],[1,1],[2,1],[0,1]]
const people = NAMES.map((name, i) => ({ name, performance: P[i][0], potential: P[i][1] }))

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance and potential</CardTitle>
        <CardDescription>The nine-box grid</CardDescription>
      </CardHeader>
      <CardContent>
        <NineBox people={people} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Everybody in the middle is a rating problem <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One department
        </div>
      </CardFooter>
    </Card>
  )
}
