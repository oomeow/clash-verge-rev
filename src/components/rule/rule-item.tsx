import {
  styled,
  Box,
  Typography,
  ListItemButton,
  IconButtonProps,
  IconButton,
  Card,
  Collapse,
  alpha,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Virtuoso } from "react-virtuoso";

interface ExpandMoreProps extends IconButtonProps {
  expand: boolean;
}

const ExpandMore = styled((props: ExpandMoreProps) => {
  const { expand, ...other } = props;
  return <IconButton {...other} />;
})(({ theme, expand }) => ({
  transform: !expand ? "rotate(0deg)" : "rotate(180deg)",
  transition: theme.transitions.create("transform", {
    duration: theme.transitions.duration.shortest,
  }),
}));

const COLOR = [
  "primary",
  "secondary",
  "info.main",
  "warning.main",
  "success.main",
];

interface Props {
  index: number;
  value: IRuleItem;
  onExpand: (expanded: boolean) => void;
}

const parseColor = (text: string) => {
  if (text === "REJECT" || text === "REJECT-DROP") return "error.main";
  if (text === "DIRECT") return "text.primary";

  let sum = 0;
  for (let i = 0; i < text.length; i++) {
    sum += text.charCodeAt(i);
  }
  return COLOR[sum % COLOR.length];
};

export const RuleItem = (props: Props) => {
  const { index, value, onExpand } = props;
  const expanded = value.type === "RuleSet" && value.expanded;

  return (
    <Card
      sx={[
        {
          margin: "6px 6px 0 0",
          "& ::-webkit-scrollbar": {
            width: "5px",
          },
          backgroundImage: "none",
        },
        ({ palette: { mode, primary } }) => {
          const bgcolor = mode === "light" ? "#ffffff" : "#282A36";
          return {
            bgcolor,
            "& ::-webkit-scrollbar-thumb": {
              backgroundColor: alpha(primary.main, 0.35),
              borderRadius: "2px",
            },
          };
        },
      ]}>
      <ListItemButton
        sx={[
          {
            ...(expanded && {
              borderBottom: "1px solid var(--divider-color)",
            }),
          },
          ({ palette: { mode, primary } }) => {
            const bgcolor =
              mode === "light"
                ? alpha(primary.main, 0.25)
                : alpha(primary.main, 0.35);
            const color = expanded ? primary.main : "";
            return {
              ...(expanded && { bgcolor }),
              "&:hover": {
                ...(expanded && { bgcolor }),
              },
              "& .MuiTypography-root": {
                color,
              },
              "& .MuiIconButton-root ": {
                color,
              },
            };
          },
        ]}
        onClick={() => {
          if (value.type === "RuleSet") {
            onExpand(expanded);
          }
        }}>
        <Typography
          color="text.secondary"
          variant="body2"
          sx={{ lineHeight: 2, minWidth: 30, mr: 2.25, textAlign: "center" }}>
          {index}
        </Typography>

        <Box sx={{ userSelect: "none", width: "100%" }}>
          <Typography component="h6" variant="subtitle1" color="text.primary">
            {value.payload || "-"}
          </Typography>

          <Typography
            component="span"
            variant="body2"
            color="text.secondary"
            sx={{ mr: 3, minWidth: 120, display: "inline-block" }}>
            {value.type}
          </Typography>

          <Typography
            component="span"
            variant="body2"
            color={parseColor(value.proxy)}>
            {value.proxy}
          </Typography>
        </Box>
        {value.type === "RuleSet" && (
          <ExpandMore
            color="primary"
            expand={expanded}
            aria-expanded={expanded}
            aria-label="show more">
            <ExpandMoreIcon />
          </ExpandMore>
        )}
      </ListItemButton>
      {value.matchPayloadItems && (
        <Collapse
          in={expanded}
          timeout={0}
          unmountOnExit
          sx={[
            ({ palette: { primary } }) => {
              return {
                bgcolor: alpha(primary.main, 0.15),
              };
            },
          ]}>
          <Box
            sx={{
              margin: "auto",
              padding: "0 6px 0 50px",
              height:
                value.matchPayloadItems.length > 10
                  ? "222px"
                  : `${value.matchPayloadItems.length * 22 + 2}px`,
            }}>
            <Virtuoso
              data={value.matchPayloadItems}
              increaseViewportBy={256}
              itemContent={(_index, item) => (
                <Box
                  sx={{
                    userSelect: "text",
                    marginTop: "2px",
                    height: "20px",
                    lineHeight: "20px",
                  }}>
                  <Typography
                    unselectable="on"
                    component="span"
                    variant="body2"
                    color="text.primary">
                    {item}
                  </Typography>
                </Box>
              )}
            />
          </Box>
        </Collapse>
      )}
    </Card>
  );
};
