import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CitationNetwork } from "@/components/charts/lib/legal"
const cases = [
  { id: "Aldridge", year: 1994, court: "CA" },
  { id: "Nakamura", year: 2001, court: "HC" },
  { id: "Fenwick", year: 1978, court: "HL" },
  { id: "Oyelaran", year: 2009, court: "CA" },
  { id: "Steadman", year: 1966, court: "HL" },
  { id: "Brackley", year: 2015, court: "SC" },
  { id: "Present", year: 2024, court: "HC" },
]
const citations = [
  { from: "Present", to: "Aldridge" }, { from: "Present", to: "Nakamura" },
  { from: "Present", to: "Fenwick" }, { from: "Present", to: "Brackley" },
  { from: "Brackley", to: "Aldridge" }, { from: "Brackley", to: "Steadman" },
  { from: "Aldridge", to: "Steadman" }, { from: "Aldridge", to: "Fenwick" },
  { from: "Nakamura", to: "Steadman" }, { from: "Oyelaran", to: "Aldridge" },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Authority graph</CardTitle>
        <CardDescription>Which cases lean on which</CardDescription>
      </CardHeader>
      <CardContent>
        <CitationNetwork cases={cases} citations={citations} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Two decisions carry the whole line <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Seven authorities
        </div>
      </CardFooter>
    </Card>
  )
}
