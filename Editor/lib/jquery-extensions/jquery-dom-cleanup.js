﻿/** 
* @FileOverview: Dom clean up routines
* depends on: jQuery-dom-traversal, jQuery-dom-manipulation
*/

(function($)
{
    $.Arte = $.Arte || {};
    $.Arte.dom = $.Arte.dom || {};

    // Cache references
    var dom = $.Arte.dom;
    var configuration = $.Arte.configuration;
    var constants = $.Arte.constants;
    var util = $.Arte.util;

    $.extend(configuration, {
        /**
    * A set of tagNames to which a style/class can be styled.  If a tagName is not styleable, the styles/classes will be applied to all of its 
    * children or the parent depending on the markup.
    */
        styleableTags: {
            SPAN: 1,
            DIV: 1,
            P: 1,
            LI: 1,
            UL: 1,
            OL: 1
        },

        /**
        * During the cleanup phase, the elements with tagName specified with Key can be merged with the parent element specified by the values
        * For example, A SPAN can be merged with SPAN/DIV/P/LI while a LI can't be merged with anything
        */
        mergableTags: {
            SPAN: { SPAN: 1, DIV: 1, P: 1, LI: 1 },
            DIV: { DIV: 1, P: 1, LI: 1 },
            P: { DIV: 1, P: 1, LI: 1 },
            LI: {},
            OL: {},
            UL: {},
            B: { B: 1 },
            U: { U: 1 },
            I: { I: 1 },
            STRONG: { STRONG: 1 },
            SUB: { SUB: 1 },
            SUP: { SUP: 1 },
            H1: { H2: 1, H3: 1, H4: 1, H5: 1, H6: 1 },
            H2: { H1: 1, H3: 1, H4: 1, H5: 1, H6: 1 },
            H3: { H1: 1, H2: 1, H4: 1, H5: 1, H6: 1 },
            H4: { H1: 1, H2: 1, H3: 1, H5: 1, H6: 1 },
            H5: { H1: 1, H2: 1, H3: 1, H4: 1, H6: 1 },
            H6: { H1: 1, H2: 1, H3: 1, H4: 1, H5: 1 }
        }
    });

    /**
    * Merge adjunct lists within the set of matched element
    * For example <ul><li>1</li><ul><ul><li>2</li></ul> => <ul><li>1</li><li>2</li></ul>
    */
    var mergeAdjunctLists = function(jNodes)
    {
        var mergeLists = function(lists)
        {
            var tagName = $(lists[0]).prop("tagName");
            var filter = function(index, node)
            {
                return !$(node).is(":emptyTextOrRangySpan");
            };
            // Start from the last element in the list and start merging backward
            while (lists.length)
            {
                var currentList = $(lists[lists.length - 1]);
                lists.splice(lists.length - 1, 1);
                var prevNode = dom.prevSiblingIncludingTextNodes(currentList, filter);

                // If the previous elements has same list tagName, merge both of these elements
                if (prevNode && prevNode.prop("tagName") === tagName)
                {
                    // Move the current node's li children to previous node
                    currentList.children().appendTo(prevNode);
                    currentList.remove();
                }
            }
        };
        jNodes.each(function()
        {
            mergeLists($(this).find(constants.tagName.OL));
            mergeLists($(this).find(constants.tagName.UL));
        });
    };

    var seekDirection = { Next: 0, Prev: 1 };
    /**
    * Get a next/prev mergable sibling such the sibling is an element with same tagName, styles, classes and is not block
    * @param {jElement} jQuery element to find the sibling of
    * @param {seekDirection} direction to navigate (Prev/Next)
    * @param {function}  function to provide filtering if finding next/prev elements
    * @return {jElement} next/prev element that is mergable 
    */
    var getMergableSibling = function(jElement, direction, filter)
    {
        var result = $();
        var op = direction == seekDirection.Next ? "nextSiblingIncludingTextNodes" : "prevSiblingIncludingTextNodes";
        var adjacentElement = dom[op](jElement, filter);

        // check if the sibling element is mergable
        if (adjacentElement.length && adjacentElement.is(":element") && // Has an element sibling
            !adjacentElement.is(":block") && // Not a block element
                jElement.prop("tagName") === adjacentElement.prop("tagName") && // has same tag
                    dom.hasSameStyleAndClass(jElement, adjacentElement)) // has same style and class
        {
            result.push(adjacentElement[0]);
        }
        return result;
    };

    /**
    * Get previous mergable sibling
    * @param {jNode} jQuery element to find the sibling of
    * @param {function}  function to provide filtering if finding next/prev elements
    * @return {jNode} next/prev element that is mergable 
    */
    var prevMergableSibling = function(jElement, filter)
    {
        return getMergableSibling(jElement, seekDirection.Prev, filter);
    };

    /**
    * Get all of the non-empty and non-rangyspan nodes
    * @param {jNode} jQuery element to find the sibling of
    */
    var getContentNodes = function(jElement)
    {
        return jElement.contents().filter(function(index, node)
        {
            return !$(node).is(":emptyTextOrRangySpan");
        });
    };

    /*
    * bubbles the style from the children to the parent if possible
    * Example 1: <div><span style="color: black"> ABC </span></div> => <div style="color: black"><span>ABC</span></div>
    * Normalize the styles: Check if we can push the styles of this child node to the parent ($this).  Following are three cases to evaluate
    * 1. if jElement has only once child, simply push all the styles up to the parent
    * 2. if jElement has multiple children and all children has same style, we should push those styles to the parent
    * 3. if any of the JElement's parents have the same style or class applied, remove it from jElement
    * @param {jElement} jElement
    */
    var bubbleStylesFromChildren = function(jElement)
    {
        var contentNodes = getContentNodes(jElement);

        if (!configuration.styleableTags[jElement.prop("tagName")])
        {  // If we can't apply styles to jElement, don't process further
            return false;
        }

        var candidateNodes = contentNodes.filter(function()
        {
            return $(this).is(":element"); // Only evaluate non-text 
        });

        candidateNodes.each(function()
        {
            var $this = $(this);
            var styles = dom.getStyles($this);
            var classes = dom.getClasses($this);

            if (contentNodes.length === 1)
            {
                // jElement has only single child, simply apply the push all the styles to $this
                $.each(styles, function(styleName, styleValue)
                {
                    jElement.css(styleName, styleValue);
                    $this.css(styleName, "");
                });

                $.each(classes, function(index, className)
                {
                    var commandConfig = util.getCommandConfig({ className: className });
                    if (commandConfig && commandConfig.classNameRegex)
                    {
                        dom.removeClassWithPattern(jElement, commandConfig.classNameRegex);
                    }
                    jElement.addClass(className);
                    contentNodes.removeClass(className);
                });
            }
            else
            {
                // jElement has 1+ children, 
                $.each(styles, function(styleName, styleValue)
                {
                    var commandConfig = util.getCommandConfig({ styleName: styleName });
                    var styleOptions = { commandName: commandConfig.commandName, styleName: styleName, styleValue: styleValue, topEditableParent: topEditableParent };
                    // If all of the children have a style value applied, push it to the node
                    if (dom.closestWithCommandValue(contentNodes, styleOptions).length === contentNodes.length)
                    {
                        // All of the nodes have the styles applied
                        jElement.css(styleName, styleValue);
                        contentNodes.css(styleName, "");
                    }
                });
                $.each(classes, function(index, className)
                {
                    // If all of the contentNodes have a class, push it to the parent and remove it from all contentNodes
                    if (dom.allHaveClass(contentNodes, className))
                    {
                        var commandConfig = util.getCommandConfig({ className: className });
                        if (commandConfig.classNameRegex)
                        {
                            dom.removeClassWithPattern(jElement, commandConfig.classNameRegex);
                        }
                        jElement.addClass(className);
                        contentNodes.removeClass(className);
                    }
                });
            }
        });
    };

    /*
    * Merge the non-block element children of jElement 
    * If two siblings have same class and styles merge them
    */
    var mergeChildren = function(jElement)
    {
        var contentNodes = getContentNodes(jElement);
        for (var i = 1; i < contentNodes.length; i++)
        {
            var $current = $(contentNodes[i]);
            if (!$current.is(":element") || $current.is(":block"))
            {
                continue;
            }

            var prev = prevMergableSibling($current);
            if (prev.get(0))
            {
                prev.append($current.contents());
                $current.remove();
            }
        }
    };

    /**
    * Remove the redundant child markup.  
    * 1) Non-block children => remove the markup if all the styles/classes are applied
    * 2) A single block child => remove the markup if the parent and child tags can be merged
    * 3) Mix of block/non-block children => remove the markup of non-block children all the styles/classes are applied
    * 4) otherwise no-op
    */
    var mergeChildrenWithSelf = function(node)
    {
        var contentNodes = getContentNodes(node);
        var candidateNodes = contentNodes.filter(function()
        {
            //Find out which nodes are candidates for evaluation to merge up with the parent
            // don't evaluate the text nodes or the block nodes with siblings
            var $this = $(this);
            var mergableTags = configuration.mergableTags[$this.prop("tagName")];

            return $this.is(":element") &&
                (!$this.is(":block") || contentNodes.length === 1) && // The only block child
                mergableTags && mergableTags[node.prop("tagName")]; // Merge only whitelisted element types
        });

        candidateNodes.each(function()
        {
            // Try to merge the child and parent;
            var $this = $(this);
            var styles = dom.getStyles($this);
            var classes = dom.getClasses($this);

            // check if the content nodes's style are applied by some parent
            // if so, we can simply unwrap the child
            var allStylesApplied = util.all(styles, function(styleName, styleValue)
            {
                var commandConfig = util.getCommandConfig({ styleName: styleName });
                var parentWithStyle = dom.closestWithCommand($this.parent(), { commandName: commandConfig.commandName, styleName: styleName });
                return parentWithStyle.get(0) && (dom.getStyles(parentWithStyle)[styleName] === styleValue);
            });

            var parents = $this.parentsUntil(topEditableParent.parentNode);
            var allClassesApplied = util.all(classes, function(index, className)
            {
                return parents.hasClass(className);
            });

            if (allStylesApplied && allClassesApplied)
            {
                $this.contents().first().unwrap();
                return;
            }
        });
    };

    /***/
    var removeRedundantStylesfromParent = function(jElement)
    {
        var contentNodes = getContentNodes(jElement);
        // If parent has a style that is applied to all of the children, remove it
        var styles = dom.getStyles(jElement);
        $.each(styles, function(styleName, styleValue)
        {
            var removeStyle = util.all(contentNodes, function(index, contentNode)
            {
                return dom.getStyles($(contentNode))[styleName];
            }) || dom.closestWithCommandValue(jElement.parent(), { styleName: styleName, styleValue: styleValue, topEditableParent: topEditableParent }).length > 0;

            if (removeStyle)
            {
                jElement.css(styleName, "");
            }
        });

        // If parent has a class that is applied to all of th children, remove it
        var classes = dom.getClasses(jElement);
        $.each(classes, function(index, className)
        {
            var commandConfig = util.getCommandConfig({ className: className });
            var allNodesHaveClass = commandConfig && commandConfig.classNameRegex && util.all(contentNodes, function(index, contentNode)
            {
                return dom.hasClassWithPattern($(contentNode), commandConfig.classNameRegex);
            }) || jElement.parents().hasClass(className);
            if (allNodesHaveClass)
            {
                jElement.removeClass(className);
            }
        });
    };

    /**
    * Cleanup Dom recursively (depth first) using the following steps for each element
    * 1) Move styles from the children to the parent element
    * 2) Remove redundant styles from the element
    * 3) Merge the children
    * 4) Unwrap the children
    */
    var removeRedundantMarkup = function(jNodes)
    {
        jNodes.each(function()
        {
            // Do not merge with the content editable element or the text nodes with the parent
            var $this = $(this);

            if (!$this.is(":element"))
            {
                return;
            }
            var nodes = getContentNodes($this);
            removeRedundantMarkup(nodes);

            // Step 1: Push the styles towards to top
            bubbleStylesFromChildren($this);

            // Step 2: If the parent has a style that is explicitly applied to all of its children, remove the style from the parent
            removeRedundantStylesfromParent($this);

            // Step 3: Try to merge all of the siblings
            mergeChildren($this);

            // Step 4: Check if we can merge any of the children with the parent node by removing the redundant html
            mergeChildrenWithSelf($this);
        });
    };

    /*
    * Clean up: Recursively remove the empty elements until there are not empty element left
    * For example: <div> <div> <div> </div> </div> </div>
    */
    var removeEmptyElements = function(jNodes)
    {
        var hasEmptyElements = true;

        var processEmptyElemenet = function()
        {
            var element = $(this);

            if (element.is(":block") &&
                    dom.nextSiblingIncludingTextNodes(element).length &&
                    dom.prevSiblingIncludingTextNodes(element).length)
            {
                // If a div has next and prev, empty div is acting like a line break
                // add a line break.
                element.before("<br />");
            }
            element.remove();
        };

        while (hasEmptyElements)
        {
            // Exclude the <br/> and rangy selection marker spans
            var emptyElements = jNodes.find(":empty").not("br").not(":rangySpan");
            hasEmptyElements = emptyElements.length > 0;
            emptyElements.each(processEmptyElemenet);
        }
    };

    /**
    * If rangy selection marker span is the only child of some element, remove that element 
    */
    var handleRangySelectionMarkers = function(jNodes)
    {
        jNodes.find("." + configuration.rangySelectionBoundaryClassName).each(function()
        {
            if ($(this).parent().contents().length === 1)
            {
                $(this).unwrap();
            }
        });
    };

    /**
    * Convert the divs to P (some browsers produce div when creating new line).
    */
    
    var convertDivsToP = function (element) {
        var pElement = element;
        if (element.prop("tagName") === constants.tagName.DIV) {
            pElement = $("<p>").html(element.html());
            // maintain the attributes from the p element
            $.each(["style", "id", "class"], function (index, attribute) {
                var attrValue = element.attr(attribute);
                if (attrValue) {
                    pElement.attr(attribute, attrValue);
                }
            });

            element.before(pElement);
            element.remove();
        }
        return pElement;
    };

    /**
    * Remove the redundant markup
    * @param
    */
    var topEditableParent;
    var cleanup = function(jNodes, options)
    {

        topEditableParent = (options && options.topEditableParent) ? options.topEditableParent : dom.getTopEditableParent(jNodes).get(0);
        handleRangySelectionMarkers(jNodes);
        removeEmptyElements(jNodes, options);
        mergeAdjunctLists(jNodes);
        removeRedundantMarkup(jNodes);
    };

    // Public API
    dom.cleanup = cleanup;
    dom.convertDivsToP = function (element)
    {
        var result = $();
        element.each(function () {
            var $this = $(this);
            $this.children().each(function () {
                var $this = $(this);
                convertDivsToP($this);
            });
            result.push(convertDivsToP($this).get(0));
        });
        return result;
    };
})(jQuery);