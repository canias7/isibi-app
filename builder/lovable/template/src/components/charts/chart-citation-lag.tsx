import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CitationLag } from "@/components/charts/lib/patents"
const citations = [
  2018, 2019, 2019, 2019, 2020, 2020, 2020, 2020, 2021, 2021, 2021, 2021, 2021,
  2022, 2022, 2022, 2022, 2022, 2022, 2023, 2023, 2023, 2023, 2023, 2023, 2023,
  2024, 2024, 2024, 2024, 2024, 2024, 2024, 2024, 2025, 2025, 2025, 2025, 2025,
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Forward citations</CardTitle>
        <CardDescription>When the citations actually arrived</CardDescription>
      </CardHeader>
      <CardContent>
        <CitationLag citations={citations} publishedYear={2016} currentYear={2025} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          This count is still growing <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Published 2016
        </div>
      </CardFooter>
    </Card>
  )
}
